'use client';

import { useState, useEffect, useRef } from 'react';
import { GlassCard, Button, Input } from '@/app/components/ui';
import { MessageSquare, Send, Loader2 } from 'lucide-react';

export default function MentorChat() {
  const [mentees, setMentees] = useState<any[]>([]);
  const [selectedMentee, setSelectedMentee] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMentees = async () => {
      try {
        const res = await fetch('/api/b2b/mentor/mentees');
        if (res.ok) setMentees(await res.json());
      } catch {} finally { setLoading(false); }
    };
    fetchMentees();
  }, []);

  useEffect(() => {
    if (!selectedMentee) return;
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/b2b/mentor/chat?menteeId=${selectedMentee}`);
        if (res.ok) setMessages(await res.json());
      } catch {}
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [selectedMentee]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedMentee) return;
    setSending(true);
    try {
      const res = await fetch('/api/b2b/mentor/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menteeId: selectedMentee, message: newMessage }),
      });
      if (res.ok) {
        setNewMessage('');
        const msgRes = await fetch(`/api/b2b/mentor/chat?menteeId=${selectedMentee}`);
        if (msgRes.ok) setMessages(await msgRes.json());
      }
    } catch {} finally { setSending(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-teal-400 animate-spin" /></div>;

  return (
    <div className="flex gap-4 h-[calc(100vh-6rem)] max-w-5xl">
      {/* Mentee List */}
      <div className="w-64 shrink-0 space-y-2 overflow-y-auto">
        <h2 className="text-sm font-semibold text-[#a1a1aa] uppercase tracking-wider px-2 mb-3">Mentees</h2>
        {mentees.map((m) => (
          <button
            key={m._id}
            onClick={() => setSelectedMentee(m._id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
              selectedMentee === m._id ? 'bg-teal-500/10 border border-teal-500/20' : 'bg-white/5 hover:bg-white/10 border border-transparent'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400 text-xs font-bold">
              {m.fullName?.substring(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm text-white truncate">{m.fullName}</p>
              <p className="text-xs text-[#a1a1aa] truncate">{m.email}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {!selectedMentee ? (
          <div className="flex-1 flex items-center justify-center text-[#a1a1aa]">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Select a mentee to start chatting</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-white/[0.02] rounded-xl border border-white/5 mb-4">
              {messages.length === 0 && <p className="text-center text-[#a1a1aa] py-8">No messages yet. Start the conversation!</p>}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.senderRole === 'mentor' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${
                    msg.senderRole === 'mentor'
                      ? 'bg-teal-500/20 text-white rounded-br-md'
                      : 'bg-white/5 text-white rounded-bl-md'
                  }`}>
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-[10px] text-[#a1a1aa] mt-1">{new Date(msg.createdAt).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex gap-2">
              <input
                className="glass-input flex-1"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Type a message..."
              />
              <Button onClick={handleSend} disabled={sending || !newMessage.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
