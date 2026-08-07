<?php

namespace App\Http\Controllers;

/**
 * Compatibility shim for routes that imported the controller without the Api namespace.
 * Keep the real implementation in App\Http\Controllers\Api\AdminHostTargetController.
 */
class AdminHostTargetController extends \App\Http\Controllers\Api\AdminHostTargetController
{
}