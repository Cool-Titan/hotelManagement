-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('GUEST', 'STAFF', 'GM');

-- CreateEnum
CREATE TYPE "Team" AS ENUM ('RESERVATIONS', 'EVENTS', 'SALES', 'MANAGEMENT');

-- CreateEnum
CREATE TYPE "RoomCategory" AS ENUM ('ROOM', 'SUITE', 'VILLA');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FLAT');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'PAYMENT_FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WEB_FORM', 'EVENT_FORM', 'EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "EnquiryCategory" AS ENUM ('ROOM', 'WEDDING', 'OFFSITE', 'COMPLAINT', 'OTHER');

-- CreateEnum
CREATE TYPE "Lane" AS ENUM ('PENDING', 'ROOM', 'WEDDING', 'OFFSITE', 'COMPLAINT', 'UNSORTED');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('OPEN', 'REPLIED', 'CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'GUEST',
    "team" "Team",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "RoomCategory" NOT NULL,
    "sizeSqm" INTEGER NOT NULL,
    "bed" TEXT NOT NULL,
    "view" TEXT NOT NULL,
    "maxAdults" INTEGER NOT NULL,
    "maxChildren" INTEGER NOT NULL,
    "maxGuests" INTEGER NOT NULL,
    "amenities" TEXT[],
    "images" TEXT[],
    "totalUnits" INTEGER NOT NULL,
    "baseRate" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatePlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "inclusions" TEXT[],
    "supplementPerNight" INTEGER NOT NULL DEFAULT 0,
    "discountPct" INTEGER NOT NULL DEFAULT 0,
    "refundable" BOOLEAN NOT NULL DEFAULT true,
    "cancellationPolicy" TEXT NOT NULL,
    "minNights" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RatePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryDay" (
    "id" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rate" INTEGER NOT NULL,
    "allotment" INTEGER NOT NULL,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "held" INTEGER NOT NULL DEFAULT 0,
    "stopSell" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlackoutDate" (
    "id" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "roomTypeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlackoutDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" INTEGER NOT NULL,
    "minNights" INTEGER NOT NULL DEFAULT 1,
    "validFrom" DATE NOT NULL,
    "validTo" DATE NOT NULL,
    "maxRedemptions" INTEGER,
    "redemptions" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "userId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "promoCodeId" TEXT,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "nights" INTEGER NOT NULL,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "guestCountry" TEXT NOT NULL,
    "specialRequests" TEXT,
    "roomTotal" INTEGER NOT NULL,
    "discountTotal" INTEGER NOT NULL,
    "taxTotal" INTEGER NOT NULL,
    "grandTotal" INTEGER NOT NULL,
    "priceLines" JSONB NOT NULL,
    "holdExpiresAt" TIMESTAMP(3),
    "paymentRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "consentAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'WEBSITE',
    "exportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "fromName" TEXT NOT NULL,
    "fromContact" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "formData" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'OPEN',
    "lane" "Lane" NOT NULL DEFAULT 'PENDING',
    "category" "EnquiryCategory",
    "confidence" DOUBLE PRECISION,
    "classifiedBy" TEXT,
    "aiModel" TEXT,
    "summary" TEXT,
    "extracted" JSONB,
    "urgency" TEXT,
    "draftReply" TEXT,
    "draftWarnings" TEXT[],
    "draftEdited" BOOLEAN NOT NULL DEFAULT false,
    "replyBody" TEXT,
    "repliedAt" TIMESTAMP(3),
    "firstReplyMins" INTEGER,
    "gmAlert" BOOLEAN NOT NULL DEFAULT false,
    "gmAlertAckAt" TIMESTAMP(3),
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryEvent" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutingRule" (
    "category" "EnquiryCategory" NOT NULL,
    "assigneeId" TEXT NOT NULL,

    CONSTRAINT "RoutingRule_pkey" PRIMARY KEY ("category")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_slug_key" ON "RoomType"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "RatePlan_code_key" ON "RatePlan"("code");

-- CreateIndex
CREATE INDEX "InventoryDay_date_idx" ON "InventoryDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryDay_roomTypeId_date_key" ON "InventoryDay"("roomTypeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");

-- CreateIndex
CREATE INDEX "Booking_status_holdExpiresAt_idx" ON "Booking"("status", "holdExpiresAt");

-- CreateIndex
CREATE INDEX "Booking_checkIn_idx" ON "Booking"("checkIn");

-- CreateIndex
CREATE INDEX "Booking_createdAt_idx" ON "Booking"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Enquiry_reference_key" ON "Enquiry"("reference");

-- CreateIndex
CREATE INDEX "Enquiry_lane_status_idx" ON "Enquiry"("lane", "status");

-- CreateIndex
CREATE INDEX "Enquiry_receivedAt_idx" ON "Enquiry"("receivedAt");

-- CreateIndex
CREATE INDEX "EnquiryEvent_enquiryId_createdAt_idx" ON "EnquiryEvent"("enquiryId", "createdAt");

-- AddForeignKey
ALTER TABLE "InventoryDay" ADD CONSTRAINT "InventoryDay_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlackoutDate" ADD CONSTRAINT "BlackoutDate_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryEvent" ADD CONSTRAINT "EnquiryEvent_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryEvent" ADD CONSTRAINT "EnquiryEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Overbooking backstop: the database itself refuses any write that would sell
-- more rooms than the website's allotment, whatever the application does.
ALTER TABLE "InventoryDay"
  ADD CONSTRAINT "InventoryDay_counters_check"
  CHECK ("sold" >= 0 AND "held" >= 0 AND "allotment" >= 0 AND "rate" > 0 AND "sold" + "held" <= "allotment");

ALTER TABLE "PromoCode"
  ADD CONSTRAINT "PromoCode_redemptions_check"
  CHECK ("redemptions" >= 0 AND ("maxRedemptions" IS NULL OR "redemptions" <= "maxRedemptions"));

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_dates_check" CHECK ("checkOut" > "checkIn" AND "grandTotal" >= 0);
