import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { 
      // Mentor Details
      mentorEmail, 
      mentorPhone, 
      mentorName, 
      password, 
      mentorDob, 
      mentorGender, 
      // College Details
      collegeName, 
      collegeLocation, 
      documentType, 
      documentName, 
      // Verification Details
      aadhaarNumber, 
      aadhaarPicName, 
      selfieName, 
      consent 
    } = data;

    if (!collegeName || !mentorEmail || !password || !mentorPhone || !consent) {
      return NextResponse.json({ error: 'Missing core registration fields or consent' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('aicoach');

    // Check if institution or mentor already exists
    const existingInst = await db.collection('institutions').findOne({ 
      $or: [{ collegeName }, { mentorEmail }, { mentorPhone }] 
    });
    
    if (existingInst) {
      return NextResponse.json({ error: 'Institution or Mentor already registered' }, { status: 400 });
    }

    // Check if mentor email or phone is already in user collection
    const existingUser = await db.collection('users').findOne({ 
      $or: [{ email: mentorEmail }, { phone: mentorPhone }] 
    });
    if (existingUser) {
      return NextResponse.json({ error: 'Email or Phone already in use by an existing user' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const institutionDoc: any = {
      // Mentor Details
      mentorEmail,
      mentorPhone,
      mentorName,
      password: hashedPassword,
      mentorDob,
      mentorGender,
      // College Details
      collegeName,
      collegeLocation,
      documentType,
      documentName,
      // Verification Details
      aadhaarNumber,
      aadhaarPicName,
      selfieName,
      consent,
      // Metadata
      status: 'pending',
      submittedAt: new Date(),
    };

    const result = await db.collection('institutions').insertOne(institutionDoc);
    const instId = result.insertedId.toString();

    // Save uploaded files to the local testing folder
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

      const docLocalName = `${instId}_document.${docExt}`;
      const aadhaarLocalName = `${instId}_aadhaar.${aadhaarExt}`;
      const selfieLocalName = `${instId}_selfie.jpg`;

      const savedDoc = saveBase64(data.documentBase64, docLocalName);
      const savedAadhaar = saveBase64(data.aadhaarBase64, aadhaarLocalName);
      const savedSelfie = saveBase64(data.selfieBase64, selfieLocalName);

      const fileUpdates: any = {};
      if (savedDoc) fileUpdates.documentLocalPath = savedDoc;
      if (savedAadhaar) fileUpdates.aadhaarLocalPath = savedAadhaar;
      if (savedSelfie) fileUpdates.selfieLocalPath = savedSelfie;

      if (Object.keys(fileUpdates).length > 0) {
        await db.collection('institutions').updateOne(
          { _id: result.insertedId },
          { $set: fileUpdates }
        );
      }
    } catch (fsErr: any) {
      console.error('Failed to save registration files locally:', fsErr.message);
    }

    return NextResponse.json({ 
      message: 'Institution registration submitted for approval', 
      id: result.insertedId 
    }, { status: 201 });

  } catch (error) {
    console.error('Institution Register Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
