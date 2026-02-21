// Override the community layout for the upgrade page — non-Pro users
// see this page and shouldn't get the community navigation.
export default function UpgradeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
