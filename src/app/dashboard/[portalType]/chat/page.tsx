'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GlassCard, Button, Input } from '@/app/components/ui';
import { MessageSquare, Send, Loader2, User } from 'lucide-react';

export default function StudentChat() {
  const params = useParams<{ portalType: string }>();
  const router = useRouter();
  const portalType = params?.portalType || 'b2c';

  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [mentorName, setMentorName] = useState<string>('Mentor');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/b2b/mentee/chat');
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        // Extract mentor name from messages if available
        const mentorMsg = data.find((msg: any) => msg.senderRole === 'mentor');
        if (mentorMsg) {
          setMentorName(mentorMsg.senderName);
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (portalType !== 'b2b') {
      router.push('/dashboard');
      return;
    }
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [portalType]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/b2b/mentee/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage }),
      });
      if (res.ok) {
        setNewMessage('');
        fetchMessages();
      }
    } catch {} finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-teal-400 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto space-y-4">
      {/* Mentor Header */}
      <GlassCard className="p-4 flex items-center justify-between border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-white font-bold">{mentorName}</h2>
            <p className="text-xs text-[#a1a1aa]">Your Assigned Mentor</p>
          </div>
        </div>
      </GlassCard>

      {/* Chat Messages Panel */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-white/[0.02] rounded-2xl border border-white/5 mb-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[#a1a1aa]">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No messages yet. Send a message to your mentor!</p>
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.senderRole === 'mentee' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${
                  msg.senderRole === 'mentee'
                    ? 'bg-amber-500/15 text-white rounded-br-md border border-amber-500/10'
                    : 'bg-white/5 text-white rounded-bl-md border border-white/5'
                }`}>
                  <p className="text-sm">{msg.message}</p>
                  <p className="text-[10px] text-[#a1a1aa] mt-1">{new Date(msg.createdAt).toLocaleTimeString()}</p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input box */}
        <div className="flex gap-2">
          <input
            className="glass-input flex-1 bg-[#0c0f1a] text-white rounded-xl border border-white/10 p-3 outline-none focus:border-amber-500/50"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type a message to your mentor..."
          />
          <Button onClick={handleSend} disabled={sending || !newMessage.trim()} className="cursor-pointer">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
