import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';
import { ObjectId } from 'mongodb';

/**
 * GET /api/b2b/mentor/chat?menteeId=xxx
 * Lists chat messages between mentor and a specific mentee.
 * 
 * POST /api/b2b/mentor/chat
 * Sends a chat message to a mentee.
 * Body: { menteeId, message }
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const menteeId = searchParams.get('menteeId');
    if (!menteeId) {
      return NextResponse.json({ error: 'menteeId query param required' }, { status: 400 });
    }

    const result = await findInstituteByUserId(user._id.toString());
    if (!result) return NextResponse.json({ error: 'Institute not found' }, { status: 404 });

    const db = await getInstituteDb(result.institute._id!);
    if (!db) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

    const messages = await db.collection('chat_messages').find({
      $or: [
        { senderId: user._id, receiverId: new ObjectId(menteeId) },
        { senderId: new ObjectId(menteeId), receiverId: user._id },
      ],
    }).sort({ createdAt: 1 }).limit(200).toArray();

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Mentor chat GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { menteeId, message } = await request.json();
    if (!menteeId || !message?.trim()) {
      return NextResponse.json({ error: 'menteeId and message required' }, { status: 400 });
    }

    const result = await findInstituteByUserId(user._id.toString());
    if (!result) return NextResponse.json({ error: 'Institute not found' }, { status: 404 });

    const db = await getInstituteDb(result.institute._id!);
    if (!db) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

    const chatMessage = {
      senderId: user._id,
      senderRole: 'mentor',
      senderName: user.fullName || user.email,
      receiverId: new ObjectId(menteeId),
      message: message.trim(),
      read: false,
      createdAt: new Date(),
    };

    await db.collection('chat_messages').insertOne(chatMessage);

    return NextResponse.json({ message: 'Message sent' }, { status: 201 });
  } catch (error) {
    console.error('Mentor chat POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
