-- Re-add average_performance (removed in 0012). ADD VALUE must run outside a transaction.
ALTER TYPE "public"."forecast_method" ADD VALUE 'average_performance';
