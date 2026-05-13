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

    const institutionDoc = {
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

    return NextResponse.json({ 
      message: 'Institution registration submitted for approval', 
      id: result.insertedId 
    }, { status: 201 });

  } catch (error) {
    console.error('Institution Register Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
