import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { PoolWarmer } from '@/lib/pool-warmer/warmer';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`👷 Admin ${user._id} triggered manual Pool Warmer run.`);

    // Run warmer orchestrator pass asynchronously so it doesn't block the request
    PoolWarmer.runOrchestrator()
      .then((res) => {
        console.log(`✅ Manual Warmer complete. Enqueued: ${res.jobsEnqueued}, Processed: ${res.jobsProcessed}`);
      })
      .catch((err) => {
        console.error(`❌ Manual Warmer run crashed:`, err.message);
      });

    return NextResponse.json({
      success: true,
      message: 'Pool Warmer Orchestration triggered in the background.'
    });

  } catch (error: any) {
    console.error('Admin Pool Warm Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
