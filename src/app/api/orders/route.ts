import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { staffUser, handleError, jsonBody, ApiError } from '@/lib/http';
import { assertText, positiveVnd, occupiedDays, slotId, assertSlotCapacity } from '@/lib/rental';
import { rentalRequest, assertItems } from '@/lib/booking-server';
import { bookingMode, verifyImmediatePickup, mustBeReadyAtPickup } from '@/lib/booking-rules';
import type { Customer, InventoryItem, RentalLine, RentalOrder } from '@/lib/types';
import { auditInTransaction } from '@/lib/audit';
export const runtime = 'nodejs';

export async function POST(req:NextRequest) {
  try {
    const me=await staffUser(req);
    const b=await jsonBody(req);
    throw new ApiError(410,'Tạo đơn theo ngày đã ngừng hỗ trợ. Vui lòng cập nhật GU và dùng quy trình v5.');
  }catch(e){return handleError(e,'POST /api/orders (retired)');}
}
