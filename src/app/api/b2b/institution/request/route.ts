import { NextResponse } from 'next/server';
import { registerInstitute, getInstituteRegistry } from '@/lib/b2b/registry';
import { generateDbName } from '@/lib/b2b/utils';

/**
 * POST /api/b2b/institution/request
 * Public endpoint: Institution submits a registration request.
 * This replaces the old /api/institution/register route.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      collegeName,
      location,
      representativeName,
      representativeEmail,
      representativePhone,
      documentType,
      documentName,
      aadhaarNumber,
      websiteUrl,
      consent,
      documentBase64,
      aadhaarPicName,
      aadhaarBase64,
      selfieBase64,
    } = body;

    // Validate required fields
    if (!collegeName || !representativeName || !representativeEmail || !representativePhone) {
      return NextResponse.json({ error: 'Missing required fields: collegeName, representativeName, representativeEmail, representativePhone' }, { status: 400 });
    }

    // Generate a candidate DB name (will be confirmed on activation)
    const dbName = generateDbName(collegeName);

    const id = await registerInstitute({
      collegeName,
      dbName,
      location: location || '',
      representativeEmail,
      representativePhone,
      representativeName,
      websiteUrl: websiteUrl || '',
      consent: !!consent,
      documents: {
        documentType: documentType || 'Aadhaar',
        documentName: documentName || '',
        aadhaarNumber: aadhaarNumber || '',
      },
      createdAt: new Date(),
    });

    // Save uploaded files to local testing folder
    try {
      const fs = require('fs');
      const path = require('path');
      const testingDir = path.join(process.cwd(), 'testing');
      if (!fs.existsSync(testingDir)) {
        fs.mkdirSync(testingDir, { recursive: true });
      }

      const saveBase64 = (dataUrl: string, filename: string) => {
        if (!dataUrl) return null;
        const commaIdx = dataUrl.indexOf(',');
        if (commaIdx === -1) return null;
        const base64Str = dataUrl.substring(commaIdx + 1);
        const buffer = Buffer.from(base64Str, 'base64');
        const filePath = path.join(testingDir, filename);
        fs.writeFileSync(filePath, buffer);
        return filename;
      };

      const docExt = documentName ? documentName.split('.').pop() : 'pdf';
      const aadhaarExt = aadhaarPicName ? aadhaarPicName.split('.').pop() : 'jpg';

      const docLocalName = `${id}_document.${docExt}`;
      const aadhaarLocalName = `${id}_aadhaar.${aadhaarExt}`;
      const selfieLocalName = `${id}_selfie.jpg`;

      const savedDoc = saveBase64(documentBase64, docLocalName);
      const savedAadhaar = saveBase64(aadhaarBase64, aadhaarLocalName);
      const savedSelfie = saveBase64(selfieBase64, selfieLocalName);

      const fileUpdates: any = {};
      if (savedDoc) fileUpdates['documents.documentLocalPath'] = savedDoc;
      if (savedAadhaar) fileUpdates['documents.aadhaarLocalPath'] = savedAadhaar;
      if (savedSelfie) fileUpdates['documents.selfieLocalPath'] = savedSelfie;

      if (Object.keys(fileUpdates).length > 0) {
        const registry = await getInstituteRegistry();
        await registry.updateOne(
          { _id: id },
          { $set: fileUpdates }
        );
      }
    } catch (fsErr: any) {
      console.error('Failed to save B2B registration files locally:', fsErr.message);
    }

    console.log(`[B2B] New institute request: "${collegeName}" (ID: ${id})`);

    return NextResponse.json({
      message: 'Registration request submitted successfully. Our team will contact you for verification.',
      requestId: id.toString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Institution request error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
