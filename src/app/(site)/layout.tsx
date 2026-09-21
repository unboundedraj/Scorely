import { MobileTabBar } from "@/components/layout/nav";
import { SiteFooter, SiteHeader } from "@/components/layout/site-header";
import { getCurrentUser } from "@/lib/data/server";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 md:pb-10">{children}</main>
      <SiteFooter />
      <MobileTabBar />
    </>
  );
}
