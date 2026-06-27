import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteRegistry } from '@/lib/b2b/registry';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'institution') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await findInstituteByUserId(user._id.toString());
    if (!result) {
      return NextResponse.json({ error: 'Institute not found' }, { status: 404 });
    }

    return NextResponse.json({ departments: result.institute.departments || [] });
  } catch (error) {
    console.error('GET departments error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

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

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { department } = body;
    if (!department || typeof department !== 'string') {
      return NextResponse.json({ error: 'department is required and must be a string' }, { status: 400 });
    }

    const trimmedDept = department.trim();
    if (trimmedDept.length === 0) {
      return NextResponse.json({ error: 'department cannot be empty' }, { status: 400 });
    }

    const registry = await getInstituteRegistry();
    await registry.updateOne(
      { _id: result.institute._id },
      { $addToSet: { departments: trimmedDept } }
    );

    return NextResponse.json({ success: true, department: trimmedDept });
  } catch (error) {
    console.error('POST departments error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'institution') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await findInstituteByUserId(user._id.toString());
    if (!result) {
      return NextResponse.json({ error: 'Institute not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');

    if (!department) {
      return NextResponse.json({ error: 'department query parameter is required' }, { status: 400 });
    }

    const registry = await getInstituteRegistry();
    await registry.updateOne(
      { _id: result.institute._id },
      { $pull: { departments: department } }
    );

    return NextResponse.json({ success: true, department });
  } catch (error) {
    console.error('DELETE departments error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
