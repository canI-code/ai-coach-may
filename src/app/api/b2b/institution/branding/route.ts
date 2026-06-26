import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteRegistry } from '@/lib/b2b/registry';

/**
 * POST /api/b2b/institution/branding
 * Updates the branding configuration for the authenticated institution.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'institution') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await findInstituteByUserId(user._id.toString());
    if (!result) {
      return NextResponse.json({ error: 'Institute not found' }, { status: 404 });
    }

    const { institute } = result;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { logoUrl, primaryColor, secondaryColor, welcomeBannerText } = body;

    // Validate input payload
    if (logoUrl !== undefined && typeof logoUrl !== 'string') {
      return NextResponse.json({ error: 'logoUrl must be a string' }, { status: 400 });
    }
    if (primaryColor !== undefined && typeof primaryColor !== 'string') {
      return NextResponse.json({ error: 'primaryColor must be a string' }, { status: 400 });
    }
    if (secondaryColor !== undefined && typeof secondaryColor !== 'string') {
      return NextResponse.json({ error: 'secondaryColor must be a string' }, { status: 400 });
    }
    if (welcomeBannerText !== undefined && typeof welcomeBannerText !== 'string') {
      return NextResponse.json({ error: 'welcomeBannerText must be a string' }, { status: 400 });
    }

    // Hex color validation helper
    const isHexColor = (color: string) => /^#[0-9A-F]{6}$/i.test(color);
    if (primaryColor && !isHexColor(primaryColor)) {
      return NextResponse.json({ error: 'primaryColor must be a valid hex color code (e.g. #FF5733)' }, { status: 400 });
    }
    if (secondaryColor && !isHexColor(secondaryColor)) {
      return NextResponse.json({ error: 'secondaryColor must be a valid hex color code (e.g. #FF5733)' }, { status: 400 });
    }

    const registry = await getInstituteRegistry();
    await registry.updateOne(
      { _id: institute._id },
      {
        $set: {
          branding: {
            logoUrl: logoUrl || '',
            primaryColor: primaryColor || '#f59e0b',
            secondaryColor: secondaryColor || '#d97706',
            welcomeBannerText: welcomeBannerText || '',
          },
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Branding update error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
