import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth';
import { ObjectId } from 'mongodb';

// GET: Fetch message history between current user and target user
export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== 'mentor' && currentUser.role !== 'mentee')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserIdStr = searchParams.get('userId');
    if (!targetUserIdStr) {
      return NextResponse.json({ error: 'Target userId is required' }, { status: 400 });
    }

    let targetUserId: ObjectId;
    try {
      targetUserId = new ObjectId(targetUserIdStr);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid target userId' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('aicoach_institutional');

    // Security check: Verify target user is in the same college / institution context
    const targetUser = await db.collection('users').findOne({ _id: targetUserId });
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    if (currentUser.collegeName !== targetUser.collegeName) {
      return NextResponse.json({ error: 'Forbidden: Users must belong to the same institution' }, { status: 403 });
    }

    // Fetch message history ordered by createdAt ascending
    const messages = await db.collection('messages').find({
      $or: [
        { senderId: currentUser._id, recipientId: targetUserId },
        { senderId: targetUserId, recipientId: currentUser._id }
      ]
    }).sort({ createdAt: 1 }).toArray();

    // Optionally mark received messages as read
    await db.collection('messages').updateMany(
      { senderId: targetUserId, recipientId: currentUser._id, read: false },
      { $set: { read: true } }
    );

    return NextResponse.json(messages);

  } catch (error: any) {
    console.error('Failed to fetch messages:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Send a message to a recipient
export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== 'mentor' && currentUser.role !== 'mentee')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { recipientId: recipientIdStr, text } = body;

    if (!recipientIdStr || !text || !text.trim()) {
      return NextResponse.json({ error: 'recipientId and non-empty text are required' }, { status: 400 });
    }

    let recipientId: ObjectId;
    try {
      recipientId = new ObjectId(recipientIdStr);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid recipientId' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('aicoach_institutional');

    // Security check: Verify recipient is in the same college / institution context
    const recipientUser = await db.collection('users').findOne({ _id: recipientId });
    if (!recipientUser) {
      return NextResponse.json({ error: 'Recipient user not found' }, { status: 404 });
    }

    if (currentUser.collegeName !== recipientUser.collegeName) {
      return NextResponse.json({ error: 'Forbidden: Users must belong to the same institution' }, { status: 403 });
    }

    const newMessage = {
      senderId: currentUser._id,
      recipientId: recipientId,
      text: text.trim(),
      createdAt: new Date(),
      read: false
    };

    await db.collection('messages').insertOne(newMessage);

    return NextResponse.json(newMessage, { status: 201 });

  } catch (error: any) {
    console.error('Failed to send message:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
