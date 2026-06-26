import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId } from '@/lib/b2b/registry';

const DEFAULT_BRANDING = {
  logoUrl: '',
  primaryColor: '#f59e0b', // Default amber-500
  secondaryColor: '#d97706', // Default amber-600
  welcomeBannerText: '',
};

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(DEFAULT_BRANDING);
    }

    const result = await findInstituteByUserId(user._id.toString());
    if (!result || !result.institute) {
      return NextResponse.json(DEFAULT_BRANDING);
    }

    const branding = result.institute.branding || {};

    return NextResponse.json({
      logoUrl: branding.logoUrl || DEFAULT_BRANDING.logoUrl,
      primaryColor: branding.primaryColor || DEFAULT_BRANDING.primaryColor,
      secondaryColor: branding.secondaryColor || DEFAULT_BRANDING.secondaryColor,
      welcomeBannerText: branding.welcomeBannerText || DEFAULT_BRANDING.welcomeBannerText,
    });
  } catch (error) {
    console.error('Error fetching branding:', error);
    return NextResponse.json(DEFAULT_BRANDING);
  }
}
