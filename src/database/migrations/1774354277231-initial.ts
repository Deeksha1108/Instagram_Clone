import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1774354277231 implements MigrationInterface {
    name = 'Initial1774354277231'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_fdb91868b03a2040db408a5333"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ef463dd9a2ce0d673350e36e0f"`);
        await queryRunner.query(`ALTER TABLE "follows" DROP CONSTRAINT "UQ_105079775692df1f8799ed0fac8"`);
        await queryRunner.query(`ALTER TABLE "follows" DROP COLUMN "followerId"`);
        await queryRunner.query(`ALTER TABLE "follows" ADD "followerId" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "follows" DROP COLUMN "followingId"`);
        await queryRunner.query(`ALTER TABLE "follows" ADD "followingId" uuid NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_0b6f3ce73b6bdf8a2e99b6ef83" ON "follows" ("followerId", "createdAt", "id") `);
        await queryRunner.query(`CREATE INDEX "IDX_a7abbfdac3e3d20652b5ee3fcb" ON "follows" ("followingId", "createdAt", "id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_105079775692df1f8799ed0fac" ON "follows" ("followerId", "followingId") `);
        await queryRunner.query(`ALTER TABLE "follows" ADD CONSTRAINT "FK_ef463dd9a2ce0d673350e36e0fb" FOREIGN KEY ("followingId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "follows" ADD CONSTRAINT "FK_fdb91868b03a2040db408a53331" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "follows" DROP CONSTRAINT "FK_fdb91868b03a2040db408a53331"`);
        await queryRunner.query(`ALTER TABLE "follows" DROP CONSTRAINT "FK_ef463dd9a2ce0d673350e36e0fb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_105079775692df1f8799ed0fac"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a7abbfdac3e3d20652b5ee3fcb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0b6f3ce73b6bdf8a2e99b6ef83"`);
        await queryRunner.query(`ALTER TABLE "follows" DROP COLUMN "followingId"`);
        await queryRunner.query(`ALTER TABLE "follows" ADD "followingId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "follows" DROP COLUMN "followerId"`);
        await queryRunner.query(`ALTER TABLE "follows" ADD "followerId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "follows" ADD CONSTRAINT "UQ_105079775692df1f8799ed0fac8" UNIQUE ("followerId", "followingId")`);
        await queryRunner.query(`CREATE INDEX "IDX_ef463dd9a2ce0d673350e36e0f" ON "follows" ("followingId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fdb91868b03a2040db408a5333" ON "follows" ("followerId") `);
    }
}