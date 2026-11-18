import { useState, useId } from 'react';
import { Button, Input } from '@/components/ui';
import {
  Mail,
  Send,
  MessageSquare,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

const INITIAL_FORM: FormState = {
  name: '',
  email: '',
  subject: '',
  message: '',
};

export function ContactSection() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'validated'>('idle');

  const messageId = useId();
  const messageErrorId = `${messageId}-error`;

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.name.trim() || form.name.trim().length < 2) {
      newErrors.name = 'Please provide your full name (minimum 2 characters).';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email.trim() || !emailRegex.test(form.email.trim())) {
      newErrors.email = 'Please provide a valid email address.';
    }

    if (!form.subject.trim() || form.subject.trim().length < 3) {
      newErrors.subject = 'Please enter an inquiry subject (minimum 3 characters).';
    }

    if (!form.message.trim() || form.message.trim().length < 10) {
      newErrors.message = 'Please provide a message with at least 10 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    // Simulate clean validation response without fabricating backend API success
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmissionStatus('validated');
    }, 400);
  };

  const handleReset = () => {
    setForm(INITIAL_FORM);
    setErrors({});
    setSubmissionStatus('idle');
  };

  const mailtoUrl = `mailto:support@skillorbit.ai?subject=${encodeURIComponent(
    form.subject || 'Platform Inquiry'
  )}&body=${encodeURIComponent(
    `Name: ${form.name}\nEmail: ${form.email}\n\nMessage:\n${form.message}`
  )}`;

  return (
    <section
      id="contact"
      className="py-16 md:py-24 relative overflow-hidden bg-midnight-navy border-t border-navy-surface/40"
      aria-label="Contact SkillOrbit AI"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Contact Information & Context */}
          <div className="lg:col-span-5 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 text-xs font-semibold text-brand-cyan">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Get in Touch</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-white tracking-tight">
              Connect with Our{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-cyan to-brand-blue">
                Platform Advisory
              </span>
            </h2>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              Have questions regarding our AI resume diagnostics, enterprise talent solutions, or
              training provider partnerships? Reach out directly to our platform team.
            </p>

            {/* Direct Contact Cards */}
            <div className="space-y-3.5 pt-2">
              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-navy/60 border border-navy-surface">
                <div className="w-10 h-10 rounded-lg bg-brand-blue/15 border border-brand-blue/30 text-brand-cyan flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-slate">
                    Support & Advisory
                  </h3>
                  <a
                    href="mailto:support@skillorbit.ai"
                    className="text-sm font-bold text-surface-white hover:text-brand-cyan transition-colors"
                  >
                    support@skillorbit.ai
                  </a>
                  <p className="text-xs text-slate-400 pt-0.5">
                    Technical inquiries & candidate support
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-navy/60 border border-navy-surface">
                <div className="w-10 h-10 rounded-lg bg-brand-purple/15 border border-brand-purple/30 text-brand-purple flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-slate">
                    Enterprise & Providers
                  </h3>
                  <a
                    href="mailto:partnerships@skillorbit.ai"
                    className="text-sm font-bold text-surface-white hover:text-brand-purple transition-colors"
                  >
                    partnerships@skillorbit.ai
                  </a>
                  <p className="text-xs text-slate-400 pt-0.5">
                    Hiring integrations & course publishing
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-navy/60 border border-navy-surface">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-slate">
                    SLA & Availability
                  </h3>
                  <p className="text-sm font-bold text-surface-white">
                    24 – 48 Business Hours
                  </p>
                  <p className="text-xs text-slate-400 pt-0.5">
                    Mon – Fri, 9:00 AM – 6:00 PM EST
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div className="lg:col-span-7 w-full">
            <div className="rounded-2xl bg-navy/60 border border-navy-surface/90 p-6 sm:p-8 shadow-card backdrop-blur-md">
              {submissionStatus === 'validated' ? (
                /* Validated Feedback Banner */
                <div className="space-y-5 text-left py-4 animate-in fade-in duration-300">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-surface-white">
                      Form Validation Successful
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      Your inquiry has been checked and validated.
                    </p>
                  </div>

                  {/* Explicit status disclosure per prompt instruction */}
                  <div className="p-4 rounded-xl bg-midnight-navy/90 border border-slate-700/80 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-brand-cyan">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Integration Status Notice</span>
                    </div>
                    <p className="text-xs text-muted-slate leading-relaxed">
                      This contact form is verified and integration-ready. Because no public contact
                      backend API endpoint is currently configured on this environment, your
                      inquiry is staged locally. You can immediately transmit this message via your
                      email client using the direct link below.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <a href={mailtoUrl} className="inline-block">
                      <Button variant="primary" size="md" className="gap-2">
                        <Mail className="w-4 h-4" />
                        <span>Send via Email Client</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                    <Button variant="outline" size="md" onClick={handleReset} className="gap-2">
                      <RotateCcw className="w-4 h-4" />
                      <span>Reset Form</span>
                    </Button>
                  </div>
                </div>
              ) : (
                /* Interactive Contact Form */
                <form onSubmit={handleSubmit} noValidate className="space-y-4 text-left">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Full Name"
                      placeholder="e.g. Alex Morgan"
                      value={form.name}
                      error={errors.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      required
                    />

                    <Input
                      label="Email Address"
                      type="email"
                      placeholder="e.g. alex@company.com"
                      value={form.email}
                      error={errors.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>

                  <Input
                    label="Subject"
                    placeholder="e.g. Platform Demonstration / Partnership"
                    value={form.subject}
                    error={errors.subject}
                    onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                    required
                  />

                  {/* Textarea for Message */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor={messageId}
                      className="block text-xs font-semibold tracking-wide text-slate-300 uppercase"
                    >
                      Message
                    </label>
                    <textarea
                      id={messageId}
                      rows={4}
                      placeholder="Describe how we can support your career or organization..."
                      value={form.message}
                      aria-invalid={Boolean(errors.message)}
                      aria-describedby={errors.message ? messageErrorId : undefined}
                      onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                      className={`w-full rounded-btn bg-midnight-navy/90 text-surface-white text-sm border px-3.5 py-2.5 transition-colors placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue resize-y ${
                        errors.message
                          ? 'border-red-500/80 focus:ring-red-500'
                          : 'border-slate-700/80 hover:border-slate-600'
                      }`}
                      required
                    />
                    {errors.message && (
                      <p id={messageErrorId} role="alert" className="text-xs text-red-400 font-medium">
                        {errors.message}
                      </p>
                    )}
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      isLoading={isSubmitting}
                      className="w-full gap-2 shadow-md shadow-brand-blue/20"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send Inquiry</span>
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContactSection;
