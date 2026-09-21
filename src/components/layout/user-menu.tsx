"use client";

import { LayoutList, LogOut, Settings, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Menu } from "@/components/ui/menu";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { initials } from "@/lib/utils";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();

  async function signOut() {
    const supabase = getBrowserSupabase();
    const { error } = (await supabase?.auth.signOut()) ?? { error: null };
    if (error) {
      toast.error(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <Menu
      label="Account menu"
      triggerClassName="grid size-10 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary-soft-foreground ring-offset-2 ring-offset-background hover:ring-2 hover:ring-primary/40"
      trigger={initials(name)}
      items={[
        {
          label: (
            <span className="min-w-0">
              <span className="block truncate font-semibold">{name}</span>
              <span className="block truncate text-xs font-normal text-muted">{email}</span>
            </span>
          ),
          disabled: true,
        },
        { label: "My matches", icon: <LayoutList className="size-4" />, href: "/matches" },
        { label: "Saved teams", icon: <Users className="size-4" />, href: "/teams" },
        { label: "Settings", icon: <Settings className="size-4" />, href: "/settings" },
        { label: "Sign out", icon: <LogOut className="size-4" />, onSelect: signOut, danger: true },
      ]}
    />
  );
}
