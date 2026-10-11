CREATE TABLE "batch_counters" (
	"prefix" text PRIMARY KEY NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"item_id" uuid NOT NULL,
	"received_at" date NOT NULL,
	"unit" text NOT NULL,
	"initial_quantity" numeric(18, 3) NOT NULL,
	"current_quantity" numeric(18, 3) NOT NULL,
	"supplier" text,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "batches_initial_positive_ck" CHECK ("batches"."initial_quantity" > 0),
	CONSTRAINT "batches_current_nonneg_ck" CHECK ("batches"."current_quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_id" bigint NOT NULL,
	"display_name" text NOT NULL,
	"username" text,
	"role" text DEFAULT 'viewer' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "employees_role_ck" CHECK ("employees"."role" in ('admin','storekeeper','production','viewer')),
	CONSTRAINT "employees_status_ck" CHECK ("employees"."status" in ('pending','active','blocked'))
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_category_ck" CHECK ("items"."category" in ('finished','raw','spares','other'))
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"type" text NOT NULL,
	"delta" numeric(18, 3) NOT NULL,
	"balance_after" numeric(18, 3) NOT NULL,
	"reason" text,
	"reference" text,
	"employee_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_type_ck" CHECK ("stock_movements"."type" in ('receipt','writeoff','correction')),
	CONSTRAINT "stock_movements_delta_nonzero_ck" CHECK ("stock_movements"."delta" <> 0),
	CONSTRAINT "stock_movements_balance_nonneg_ck" CHECK ("stock_movements"."balance_after" >= 0)
);
--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "batches_code_uq" ON "batches" USING btree ("code");--> statement-breakpoint
CREATE INDEX "batches_item_idx" ON "batches" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "batches_received_idx" ON "batches" USING btree ("received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_telegram_id_uq" ON "employees" USING btree ("telegram_id");--> statement-breakpoint
CREATE UNIQUE INDEX "items_category_name_uq" ON "items" USING btree ("category",lower("name"));--> statement-breakpoint
CREATE INDEX "stock_movements_batch_idx" ON "stock_movements" USING btree ("batch_id","created_at");