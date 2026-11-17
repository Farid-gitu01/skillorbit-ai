import { type FormEvent, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/components/ui';
import { aiService } from '@/services';
import type {
  AiChatTopic,
  AiConversation,
  AiConversationSummary,
} from '@/types';
import {
  Bot,
  MessageSquarePlus,
  Send,
  ShieldAlert,
  Trash2,
  User,
} from 'lucide-react';

const MAX_MESSAGE_CHARS = 2000;

const TOPICS: Array<{ value: AiChatTopic; label: string }> = [
  { value: 'general', label: 'General Career Advice' },
  { value: 'resume', label: 'Resume Improvement' },
  { value: 'skills', label: 'Skill Planning' },
  { value: 'interview', label: 'Interview Prep' },
  { value: 'job_search', label: 'Job Search Strategy' },
];

export function AiCareerAssistantPage() {
  const [conversations, setConversations] = useState<AiConversationSummary[]>([]);
  const [activeConversation, setActiveConversation] = useState<AiConversation | null>(null);
  const [topic, setTopic] = useState<AiChatTopic>('general');
  const [includeProfileContext, setIncludeProfileContext] = useState(true);
  const [message, setMessage] = useState('');
  const [disclaimer, setDisclaimer] = useState<string>(
    'AI career guidance is advisory only. Always verify factual details and job requirements independently.'
  );

  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const list = await aiService.listConversations();
        if (!active) return;
        setConversations(list);
        if (list[0]) {
          const full = await aiService.getConversation(list[0]._id);
          if (!active) return;
          setActiveConversation(full);
          setTopic(full.topic);
        }
        setError(null);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load assistant conversations.');
        }
      } finally {
        if (active) {
          setIsLoadingList(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const handleSelectConversation = async (id: string) => {
    setError(null);
    try {
      const full = await aiService.getConversation(id);
      setActiveConversation(full);
      setTopic(full.topic);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open conversation.');
    }
  };

  const handleNewChat = () => {
    setActiveConversation(null);
    setError(null);
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await aiService.deleteConversation(id);
      const next = conversations.filter((c) => c._id !== id);
      setConversations(next);
      if (activeConversation?._id === id) {
        setActiveConversation(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete conversation.');
    }
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setError(null);
    try {
      const res = await aiService.sendChatMessage({
        message: trimmed,
        conversationId: activeConversation?._id,
        topic,
        includeProfileContext,
      });
      setActiveConversation(res.conversation);
      setDisclaimer(res.disclaimer);
      setMessage('');
      setConversations((prev) => {
        const filtered = prev.filter((c) => c._id !== res.conversation._id);
        return [
          {
            _id: res.conversation._id,
            title: res.conversation.title,
            topic: res.conversation.topic,
            lastMessageAt: res.conversation.lastMessageAt,
            createdAt: res.conversation.createdAt,
          },
          ...filtered,
        ];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Career assistant is temporarily unavailable.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-brand-cyan" />
            <span>AI Career Assistant</span>
          </h1>
          <p className="text-xs text-muted-slate mt-1">
            Ask focused questions on resumes, skills, interview prep, or career planning.
          </p>
        </div>
        <Button type="button" variant="primary" size="sm" onClick={handleNewChat} className="gap-1.5">
          <MessageSquarePlus className="w-4 h-4" />
          <span>New Conversation</span>
        </Button>
      </div>

      {error && (
        <Alert variant="error" title="Assistant Unavailable">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Conversation History Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Recent Conversations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoadingList ? (
              <Skeleton className="h-32 rounded-lg" />
            ) : conversations.length === 0 ? (
              <p className="text-xs text-muted-slate py-4">
                No previous chats yet. Send a message to start.
              </p>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv._id}
                  onClick={() => void handleSelectConversation(conv._id)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition flex items-start justify-between gap-2 ${
                    activeConversation?._id === conv._id
                      ? 'border-brand-cyan bg-brand-cyan/10'
                      : 'border-navy-surface bg-navy hover:border-brand-blue/40'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-surface-white truncate">{conv.title}</p>
                    <p className="text-[11px] text-muted-slate capitalize mt-0.5">{conv.topic.replace('_', ' ')}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete conversation ${conv.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteConversation(conv._id);
                    }}
                    className="text-red-400 hover:text-red-300 p-0.5 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Active Chat Panel */}
        <Card className="lg:col-span-3 flex flex-col">
          <CardHeader className="border-b border-navy-surface">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">
                  {activeConversation ? activeConversation.title : 'New Career Conversation'}
                </CardTitle>
                <Badge variant="info" className="capitalize">
                  {topic.replace('_', ' ')}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <select
                  aria-label="Conversation topic"
                  value={topic}
                  disabled={Boolean(activeConversation)}
                  onChange={(e) => setTopic(e.target.value as AiChatTopic)}
                  className="rounded-input bg-navy border border-navy-surface px-2.5 py-1 text-xs text-surface-white disabled:opacity-60"
                >
                  {TOPICS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-muted-slate cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeProfileContext}
                    onChange={(e) => setIncludeProfileContext(e.target.checked)}
                    className="accent-brand-cyan"
                  />
                  <span>Use My Profile Skills</span>
                </label>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 flex-1 flex flex-col justify-between gap-4 min-h-[420px]">
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              {!activeConversation || activeConversation.messages.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Bot className="w-10 h-10 text-brand-cyan mx-auto opacity-80" />
                  <p className="text-sm font-semibold text-surface-white">
                    Ask your SkillOrbit AI Career Coach
                  </p>
                  <p className="text-xs text-muted-slate max-w-md mx-auto">
                    Try asking how to tailor your resume bullet points, prepare for system design interviews, or prioritize missing skills.
                  </p>
                </div>
              ) : (
                activeConversation.messages.map((entry, idx) => (
                  <div
                    key={entry._id ?? `${entry.role}-${idx}`}
                    className={`flex items-start gap-3 ${
                      entry.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {entry.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-brand-cyan/15 text-brand-cyan flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                        entry.role === 'user'
                          ? 'bg-brand-blue text-white'
                          : 'bg-navy border border-navy-surface text-slate-200'
                      }`}
                    >
                      {entry.content}
                    </div>
                    {entry.role === 'user' && (
                      <div className="w-7 h-7 rounded-full bg-brand-purple/20 text-brand-purple flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2 pt-3 border-t border-navy-surface">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-slate">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-brand-cyan" />
                <span>{disclaimer}</span>
              </div>

              <form onSubmit={handleSend} className="space-y-2">
                <textarea
                  rows={3}
                  maxLength={MAX_MESSAGE_CHARS}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask a career, resume, interview, or skill development question..."
                  className="w-full rounded-input bg-navy border border-navy-surface px-3 py-2 text-sm text-surface-white placeholder:text-muted-slate focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-slate">
                    {message.length} / {MAX_MESSAGE_CHARS} characters
                  </span>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSending}
                    disabled={!message.trim() || isSending}
                    className="gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Message</span>
                  </Button>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AiCareerAssistantPage;
