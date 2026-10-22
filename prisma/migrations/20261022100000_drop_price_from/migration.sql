-- «от» в цене нужно только клиентам на сайте; в CRM сумма в сделке и так правится
ALTER TABLE "Product" DROP COLUMN "priceFrom";
