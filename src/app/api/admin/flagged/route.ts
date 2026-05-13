import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('aicoach');
    const usersCollection = db.collection('users');

    const flaggedUsers = await usersCollection.find({ 
      isFlagged: true 
    }).toArray();

    return NextResponse.json(flaggedUsers);
  } catch (error) {
    console.error('Error fetching flagged users:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { identifier, action } = await request.json();

    if (!identifier || !action) {
      return NextResponse.json({ error: 'Identifier and action are required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('aicoach');
    const usersCollection = db.collection('users');

    const userIdentifier = identifier.includes('@') ? { email: identifier } : { phone: identifier };

    if (action === 'reactivate') {
      await usersCollection.updateOne(
        userIdentifier,
        { 
          $set: { 
            isFlagged: false, 
            isActive: true,
            reactivatedAt: new Date(),
            reactivationReason: 'Reactivated by admin'
          }
        }
      );
      return NextResponse.json({ message: 'Account reactivated successfully' });
    } else if (action === 'deactivate') {
      await usersCollection.updateOne(
        userIdentifier,
        { 
          $set: { 
            isActive: false,
            deactivatedAt: new Date(),
            deactivationReason: 'Permanently deactivated by admin'
          }
        }
      );
      return NextResponse.json({ message: 'Account deactivated permanently' });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error updating flagged user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}