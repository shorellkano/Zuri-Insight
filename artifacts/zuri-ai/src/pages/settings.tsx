import { User, Bell, Globe, Shield, Share2 } from "lucide-react";
import { Link } from "wouter";

export default function Settings() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6" data-testid="settings-page">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      {[
        {
          icon: User,
          title: "Profile",
          desc: "Manage your personal information and account details.",
          items: [
            { label: "Full Name", placeholder: "Your name" },
            { label: "Email Address", placeholder: "your@email.com" },
            { label: "Company / Organization", placeholder: "Your company" },
          ]
        },
        {
          icon: Globe,
          title: "Regional Preferences",
          desc: "Customize Zuri AI for your primary market.",
          items: [
            { label: "Primary Market", placeholder: "e.g. West Africa - Nigeria, Ghana" },
            { label: "Preferred Language", placeholder: "English" },
          ]
        },
      ].map(({ icon: Icon, title, desc, items }) => (
        <div key={title} className="bg-card border border-border rounded-2xl p-7" data-testid={`settings-section-${title}`}>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{title}</h2>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
          <div className="space-y-4">
            {items.map(({ label, placeholder }) => (
              <div key={label}>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{label}</label>
                <input placeholder={placeholder} className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" data-testid={`settings-input-${label}`} />
              </div>
            ))}
          </div>
          <button className="mt-5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors" data-testid={`settings-save-${title}`}>
            Save Changes
          </button>
        </div>
      ))}

      <div className="bg-card border border-border rounded-2xl p-7">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bell className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Notifications</h2>
            <p className="text-xs text-muted-foreground">Choose what updates you want to receive.</p>
          </div>
        </div>
        <div className="space-y-3">
          {["Content generation complete", "Brand DNA updates", "Weekly usage summary", "Product updates & new features"].map((label) => (
            <label key={label} className="flex items-center justify-between py-2 cursor-pointer" data-testid={`notification-toggle-${label}`}>
              <span className="text-sm text-foreground">{label}</span>
              <div className="h-5 w-9 rounded-full bg-primary relative cursor-pointer">
                <div className="absolute right-0.5 top-0.5 h-4 w-4 bg-white rounded-full shadow-sm" />
              </div>
            </label>
          ))}
        </div>
      </div>

      <Link href="/settings/social">
        <div className="bg-card border border-border rounded-2xl p-7 hover:border-primary/40 transition-colors cursor-pointer group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Share2 className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Social Accounts</h2>
                <p className="text-xs text-muted-foreground">Connect Instagram and other platforms for auto-publishing.</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">Manage →</span>
          </div>
        </div>
      </Link>

      <div className="bg-card border border-destructive/20 rounded-2xl p-7">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-xl bg-destructive/10 flex items-center justify-center">
            <Shield className="h-4.5 w-4.5 text-destructive" />
          </div>
          <h2 className="font-semibold text-foreground">Danger Zone</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
        <button className="px-4 py-2 border border-destructive text-destructive rounded-lg text-sm font-semibold hover:bg-destructive/10 transition-colors" data-testid="btn-delete-account">
          Delete Account
        </button>
      </div>
    </div>
  );
}
