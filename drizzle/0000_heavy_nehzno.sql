CREATE TYPE "public"."action" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TYPE "public"."emotional_state" AS ENUM('calm', 'fomo', 'revenge', 'anxiety', 'confidence');--> statement-breakpoint
CREATE TYPE "public"."exit_reason" AS ENUM('hit_target', 'hit_stop', 'panic', 'anxiety', 'reevaluation', 'other');--> statement-breakpoint
CREATE TYPE "public"."primary_strategy" AS ENUM('technical', 'fundamental', 'news', 'social_proof', 'other');--> statement-breakpoint
CREATE TYPE "public"."trade_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "bias_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"week_start" date NOT NULL,
	"disposition_ratio" numeric(5, 2),
	"disposition_cost" numeric(10, 2),
	"revenge_baseline_winrate" numeric(5, 4),
	"revenge_conditional_winrate" numeric(5, 4),
	"revenge_trades_count" integer,
	"fomo_strategy_pnl" numeric(10, 2),
	"ai_narrative" text,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shadow_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"shadow_exit_price" numeric(10, 2) NOT NULL,
	"shadow_exit_date" timestamp with time zone NOT NULL,
	"shadow_pnl" numeric(10, 2) NOT NULL,
	"pnl_delta" numeric(10, 2) NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shadow_outcomes_trade_id_unique" UNIQUE("trade_id")
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"action" "action" NOT NULL,
	"quantity" integer NOT NULL,
	"entry_price" numeric(10, 2) NOT NULL,
	"entry_date" timestamp with time zone NOT NULL,
	"exit_price" numeric(10, 2),
	"exit_date" timestamp with time zone,
	"status" "trade_status" DEFAULT 'open' NOT NULL,
	"entry_reasoning" text NOT NULL,
	"exit_reasoning" text,
	"primary_strategy" "primary_strategy" NOT NULL,
	"emotional_state_entry" "emotional_state" NOT NULL,
	"planned_target_price" numeric(10, 2),
	"planned_stop_loss" numeric(10, 2),
	"exit_reason" "exit_reason",
	"emotional_state_exit" "emotional_state",
	"realized_pnl" numeric(10, 2),
	"is_deviation" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bias_reports" ADD CONSTRAINT "bias_reports_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shadow_outcomes" ADD CONSTRAINT "shadow_outcomes_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bias_reports_user_id_week_start_idx" ON "bias_reports" USING btree ("user_id","week_start");--> statement-breakpoint
CREATE INDEX "trades_user_id_status_idx" ON "trades" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "trades_user_id_entry_date_idx" ON "trades" USING btree ("user_id","entry_date" DESC NULLS LAST);