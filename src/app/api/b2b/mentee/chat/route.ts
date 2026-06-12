import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/b2b/mentee/chat
 * Lists chat messages between the mentee and their assigned mentor.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'mentee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await findInstituteByUserId(user._id.toString());
    if (!result) return NextResponse.json({ error: 'Institute not found' }, { status: 404 });

    const db = await getInstituteDb(result.institute._id!);
    if (!db) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

    // Find the mentee's record to get their mentorId
    const mentee = await db.collection('users').findOne({ _id: user._id });
    if (!mentee) return NextResponse.json({ error: 'Mentee not found' }, { status: 404 });

    const mentorId = mentee.mentorId;
    if (!mentorId) {
      return NextResponse.json([]); // No mentor assigned yet
    }

    const messages = await db.collection('chat_messages').find({
      $or: [
        { senderId: user._id, receiverId: new ObjectId(mentorId) },
        { senderId: new ObjectId(mentorId), receiverId: user._id },
      ],
    }).sort({ createdAt: 1 }).limit(200).toArray();

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Mentee chat GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/b2b/mentee/chat
 * Sends a message to the assigned mentor.
 * Body: { message }
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'mentee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message } = await request.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    const result = await findInstituteByUserId(user._id.toString());
    if (!result) return NextResponse.json({ error: 'Institute not found' }, { status: 404 });

    const db = await getInstituteDb(result.institute._id!);
    if (!db) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

    // Find the mentee's record to get their mentorId
    const mentee = await db.collection('users').findOne({ _id: user._id });
    if (!mentee) return NextResponse.json({ error: 'Mentee not found' }, { status: 404 });

    const mentorId = mentee.mentorId;
    if (!mentorId) {
      return NextResponse.json({ error: 'No mentor assigned to your profile yet' }, { status: 400 });
    }

    const chatMessage = {
      senderId: user._id,
      senderRole: 'mentee',
      senderName: user.fullName || user.email,
      receiverId: new ObjectId(mentorId),
      message: message.trim(),
      read: false,
      createdAt: new Date(),
    };

    await db.collection('chat_messages').insertOne(chatMessage);

    return NextResponse.json({ message: 'Message sent' }, { status: 201 });
  } catch (error) {
    console.error('Mentee chat POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
