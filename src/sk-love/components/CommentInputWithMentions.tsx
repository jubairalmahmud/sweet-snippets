// @ts-nocheck
import React, { useState, useMemo } from "react";

interface CommentInputWithMentionsProps {
  postId: number;
  onSubmitComment: (commentText: string) => void;
  placeholder?: string;
  simulatedUsers: any[];
}

export default function CommentInputWithMentions({
  postId,
  onSubmitComment,
  placeholder = "Type a thoughtful comment...",
  simulatedUsers,
}: CommentInputWithMentionsProps) {
  const [text, setText] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownQuery, setDropdownQuery] = useState("");
  const [selectedUserIndex, setSelectedUserIndex] = useState(0);

  // Suggestions list
  const filteredUsers = useMemo(() => {
    if (!dropdownQuery) return simulatedUsers;
    return simulatedUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(dropdownQuery.toLowerCase()) ||
        (u.username && u.username.toLowerCase().includes(dropdownQuery.toLowerCase())),
    );
  }, [dropdownQuery, simulatedUsers]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setText(value);

    // Find if user is typing a mention
    const words = value.split(" ");
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith("@")) {
      const query = lastWord.slice(1);
      setDropdownQuery(query);
      setShowDropdown(true);
      setSelectedUserIndex(0);
    } else {
      setShowDropdown(false);
    }
  };

  const selectUser = (username: string) => {
    const words = text.split(" ");
    // replace last word starting with @ with @Username
    words[words.length - 1] = `@${username}`;
    setText(words.join(" ") + " ");
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown && filteredUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedUserIndex((prev) => (prev + 1) % filteredUsers.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedUserIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const user = filteredUsers[selectedUserIndex];
        const formattedMention = user.name.replace(/\s+/g, "");
        selectUser(formattedMention);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowDropdown(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmitComment(text.trim());
    setText("");
    setShowDropdown(false);
  };

  return (
    <div className="relative flex-1 font-sans">
      <form onSubmit={handleSubmit} className="flex gap-1.5 pt-1 font-sans">
        <input
          type="text"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-slate-950 p-2 text-[10px] rounded-lg text-slate-200 border border-slate-900 focus:border-[#e91e63] outline-none font-sans"
        />
        <button
          type="submit"
          className="px-3 rounded-lg bg-pink-600 hover:bg-pink-500 font-bold text-[10px] text-white transition active:scale-95 uppercase"
        >
          Send
        </button>
      </form>

      {/* Autocomplete Suggestions Dropdown */}
      {showDropdown && filteredUsers.length > 0 && (
        <div className="absolute left-0 bottom-full mb-1 w-44 bg-[#100d23] border border-slate-800 rounded-xl shadow-2xl z-50 max-h-36 overflow-y-auto scrollbar-thin p-1 flex flex-col gap-0.5 animate-fadeIn">
          <p className="text-[7.5px] text-slate-500 font-black uppercase px-2 py-1 select-none border-b border-slate-900/60 leading-tight">
            Mention Users (@)
          </p>
          {filteredUsers.slice(0, 5).map((user, idx) => {
            const formattedMention = user.name.replace(/\s+/g, "");
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => selectUser(formattedMention)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left text-[9.5px] transition-all ${
                  idx === selectedUserIndex
                    ? "bg-pink-600 font-black text-white"
                    : "text-slate-300 hover:bg-slate-900"
                }`}
              >
                {user.avatar && (user.avatar.startsWith("http") || user.avatar.startsWith("data:")) ? (
                  <img src={user.avatar} alt="" className="w-4.5 h-4.5 rounded-full object-cover shrink-0 border border-slate-800" />
                ) : (
                  <span className="w-4.5 h-4.5 rounded-full bg-slate-900/60 border border-slate-800 flex items-center justify-center text-[7.5px] shrink-0 font-sans">
                    {user.avatar || "👤"}
                  </span>
                )}
                <div className="truncate flex-1 min-w-0">
                  <p
                    className={`font-bold truncate leading-none ${idx === selectedUserIndex ? "text-white" : "text-slate-200"}`}
                  >
                    {user.name}
                  </p>
                  <p
                    className={`text-[7px] truncate mt-0.5 leading-none ${idx === selectedUserIndex ? "text-pink-200" : "text-slate-500"}`}
                  >
                    @{formattedMention}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
