import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { z } from 'zod';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

const alertSchema = z.object({
  email: z.string().email('Invalid email format').transform(val => val.trim().toLowerCase()),
  companies: z.array(z.string()).optional().default([]),
  locations: z.array(z.string()).optional().default([]),
  keywords: z.array(z.string()).optional().default([]),
  frequency: z.enum(['daily', 'weekly'], {
    message: 'Frequency must be either daily or weekly'
  }),
});

interface Alert {
  id: string;
  email: string;
  companies: string[];
  locations: string[];
  keywords: string[];
  frequency: 'daily' | 'weekly';
  createdAt: string;
  isActive: boolean;
}

// GET - Retrieve existing alert by email
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    const emailValidation = z.string().email().safeParse(email);
    if (!emailValidation.success) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailKey = `email:${normalizedEmail}:alerts`;
    const alertIds = await redis.get<string[]>(emailKey) || [];

    if (alertIds.length === 0) {
      return NextResponse.json({ exists: false }, { status: 200 });
    }

    // Get the alert details
    const alertData = await redis.get<Alert>(alertIds[0]);

    if (!alertData) {
      return NextResponse.json({ exists: false }, { status: 200 });
    }

    return NextResponse.json({
      exists: true,
      alert: {
        id: alertData.id,
        email: alertData.email,
        companies: alertData.companies,
        locations: alertData.locations,
        keywords: alertData.keywords,
        frequency: alertData.frequency,
        createdAt: alertData.createdAt,
      }
    });
  } catch (error) {
    console.error('Error retrieving alert:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = alertSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.issues.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    const { email, companies, locations, keywords, frequency } = validation.data;

    const emailKey = `email:${email}:alerts`;
    const existingAlerts = await redis.get<string[]>(emailKey) || [];

    if (existingAlerts.length > 0) {
      const existingAlert = await redis.get<Alert>(existingAlerts[0]);
      return NextResponse.json(
        {
          error: 'An alert already exists for this email address',
          existingAlert: existingAlert ? {
            id: existingAlert.id,
            email: existingAlert.email,
            companies: existingAlert.companies,
            locations: existingAlert.locations,
            keywords: existingAlert.keywords,
            frequency: existingAlert.frequency,
            createdAt: existingAlert.createdAt,
          } : null
        },
        { status: 409 }
      );
    }

    const alertId = `alert:${Date.now()}:${Math.random().toString(36).substring(7)}`;
    const alert: Alert = {
      id: alertId,
      email,
      companies,
      locations,
      keywords,
      frequency,
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    await redis.set(alertId, JSON.stringify(alert));

    await redis.set(emailKey, JSON.stringify([alertId]));

    const allAlertsKey = 'alerts:all';
    const allAlerts = await redis.get<string[]>(allAlertsKey) || [];
    await redis.set(allAlertsKey, JSON.stringify([...allAlerts, alertId]));

    return NextResponse.json({
      success: true,
      message: 'Alert created successfully',
      alertId,
    });
  } catch (error) {
    console.error('Error creating alert:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = alertSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.issues.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    const { email, companies, locations, keywords, frequency } = validation.data;

    const emailKey = `email:${email}:alerts`;
    const existingAlerts = await redis.get<string[]>(emailKey) || [];

    if (existingAlerts.length === 0) {
      return NextResponse.json(
        { error: 'No alert found for this email address' },
        { status: 404 }
      );
    }

    const alertId = existingAlerts[0];
    const existingAlert = await redis.get<Alert>(alertId);

    if (!existingAlert) {
      return NextResponse.json(
        { error: 'Alert data not found' },
        { status: 404 }
      );
    }

    const updatedAlert: Alert = {
      ...existingAlert,
      companies,
      locations,
      keywords,
      frequency,
    };

    await redis.set(alertId, JSON.stringify(updatedAlert));

    return NextResponse.json({
      success: true,
      message: 'Alert updated successfully',
      alert: {
        id: updatedAlert.id,
        email: updatedAlert.email,
        companies: updatedAlert.companies,
        locations: updatedAlert.locations,
        keywords: updatedAlert.keywords,
        frequency: updatedAlert.frequency,
        createdAt: updatedAlert.createdAt,
      }
    });
  } catch (error) {
    console.error('Error updating alert:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    const emailValidation = z.string().email().safeParse(email);
    if (!emailValidation.success) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailKey = `email:${normalizedEmail}:alerts`;
    const alertIds = await redis.get<string[]>(emailKey) || [];

    if (alertIds.length === 0) {
      return NextResponse.json(
        { error: 'No alert found for this email address' },
        { status: 404 }
      );
    }

    const alertId = alertIds[0];

    await redis.del(alertId);
    await redis.del(emailKey);

    const allAlertsKey = 'alerts:all';
    const allAlerts = await redis.get<string[]>(allAlertsKey) || [];
    const updatedAllAlerts = allAlerts.filter(id => id !== alertId);
    await redis.set(allAlertsKey, JSON.stringify(updatedAllAlerts));

    return NextResponse.json({
      success: true,
      message: 'Alert deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting alert:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
