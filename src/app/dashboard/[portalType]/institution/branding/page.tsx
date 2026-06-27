import { redirect } from 'next/navigation';

export default function BrandingRedirect({ params }: { params: { portalType: string } }) {
  redirect(`/dashboard/${params.portalType}/institution/settings`);
}
