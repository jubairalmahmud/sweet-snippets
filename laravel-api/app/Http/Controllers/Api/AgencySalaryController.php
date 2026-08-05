<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SalaryCalculator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\View;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Agent-facing salary endpoints (READ-ONLY).
 *   GET /api/agency/salary/months
 *   GET /api/agency/salary?year=&month=
 *   GET /api/agency/salary/pdf?year=&month=
 */
class AgencySalaryController extends Controller
{
    public function __construct(protected SalaryCalculator $calc) {}

    protected function currentAgencyId(): ?int
    {
        $user = Auth::user();
        if (!$user || !Schema::hasTable('agency_applications')) return null;
        $row = DB::table('agency_applications')
            ->where('user_id', $user->id)->where('status', 'approved')
            ->orderByDesc('id')->first();
        return $row ? (int) $row->id : null;
    }

    protected function agencyName(int $agencyId): string
    {
        $r = DB::table('agency_applications')->where('id', $agencyId)->first();
        return $r->agency_name ?? $r->name ?? ('Agency #' . $agencyId);
    }

    public function months()
    {
        $agencyId = $this->currentAgencyId();
        if (!$agencyId) return response()->json(['message' => 'Not an approved agency'], 403);

        $out = [];
        // last 12 months + any locked periods
        for ($i = 0; $i < 12; $i++) {
            $d = now()->startOfMonth()->subMonths($i);
            $out[] = ['year' => (int) $d->year, 'month' => (int) $d->month, 'label' => $d->format('F Y')];
        }
        if (Schema::hasTable('salary_periods')) {
            $locked = DB::table('salary_periods')->where('agency_id', $agencyId)
                ->where('status', 'locked')->get(['year', 'month']);
            foreach ($locked as $l) {
                $exists = collect($out)->contains(fn ($r) => $r['year'] == $l->year && $r['month'] == $l->month);
                if (!$exists) {
                    $d = \Carbon\Carbon::createFromDate($l->year, $l->month, 1);
                    $out[] = ['year' => (int) $l->year, 'month' => (int) $l->month, 'label' => $d->format('F Y')];
                }
            }
        }
        return response()->json(['months' => $out]);
    }

    public function show(Request $request)
    {
        $agencyId = $this->currentAgencyId();
        if (!$agencyId) return response()->json(['message' => 'Not an approved agency'], 403);

        $year = (int) $request->query('year', now()->year);
        $month = (int) $request->query('month', now()->month);
        $data = $this->calc->computeOrLocked($agencyId, $year, $month);
        $data['agency_name'] = $this->agencyName($agencyId);
        return response()->json($data);
    }

    public function pdf(Request $request)
    {
        $agencyId = $this->currentAgencyId();
        if (!$agencyId) return response()->json(['message' => 'Not an approved agency'], 403);

        $year = (int) $request->query('year', now()->year);
        $month = (int) $request->query('month', now()->month);
        $data = $this->calc->computeOrLocked($agencyId, $year, $month);
        $data['agency_name'] = $this->agencyName($agencyId);

        $html = View::make('pdf.agency-salary', ['d' => $data])->render();
        $filename = sprintf('salary_%s_%04d_%02d.pdf', preg_replace('/\W+/', '_', $data['agency_name']), $year, $month);

        // Prefer dompdf if installed; else return HTML with .pdf-like Content-Disposition
        if (class_exists(\Barryvdh\DomPDF\Facade\Pdf::class)) {
            $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html)->setPaper('a4', 'portrait');
            return $pdf->download($filename);
        }
        if (class_exists(\Dompdf\Dompdf::class)) {
            $dompdf = new \Dompdf\Dompdf();
            $dompdf->loadHtml($html);
            $dompdf->setPaper('a4', 'portrait');
            $dompdf->render();
            return response($dompdf->output(), 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            ]);
        }

        // Fallback: browser-printable HTML (user can Save as PDF).
        return response($html, 200, [
            'Content-Type' => 'text/html; charset=utf-8',
            'Content-Disposition' => 'inline; filename="' . str_replace('.pdf', '.html', $filename) . '"',
        ]);
    }
}
