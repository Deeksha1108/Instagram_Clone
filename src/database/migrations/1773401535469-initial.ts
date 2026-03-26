import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1773401535469 implements MigrationInterface {
    name = 'Initial1773401535469'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD "sessionId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD CONSTRAINT "UQ_f1d56cb09724333a500af7fe914" UNIQUE ("sessionId")`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ALTER COLUMN "device" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ALTER COLUMN "device" DROP DEFAULT`);
        await queryRunner.query(`CREATE INDEX "IDX_f1d56cb09724333a500af7fe91" ON "user_sessions" ("sessionId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_f1d56cb09724333a500af7fe91"`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ALTER COLUMN "device" SET DEFAULT 'mobile'`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ALTER COLUMN "device" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP CONSTRAINT "UQ_f1d56cb09724333a500af7fe914"`);
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP COLUMN "sessionId"`);
    }

}
