import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1774250927169 implements MigrationInterface {
    name = 'Initial1774250927169'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_fe0bb3f6520ee0469504521e71"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a000cca60bcf04454e72769949"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "dateOfBirth" date`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "gender"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "gender" smallint`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_f9740e1e654a5daddb82c60bd75"`);
        await queryRunner.query(`CREATE INDEX "IDX_f9740e1e654a5daddb82c60bd7" ON "users" ("facebookId") `);
        await queryRunner.query(`CREATE INDEX "IDX_47c9769dc90dda57de8f29a5fc" ON "users" ("username", "isVerified") `);
        await queryRunner.query(`CREATE INDEX "IDX_c559222adf737b16d8c94278bf" ON "users" ("phone", "isVerified") `);
        await queryRunner.query(`CREATE INDEX "IDX_136aac53fa22201c0ff93740ab" ON "users" ("email", "isVerified") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_136aac53fa22201c0ff93740ab"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c559222adf737b16d8c94278bf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_47c9769dc90dda57de8f29a5fc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f9740e1e654a5daddb82c60bd7"`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_f9740e1e654a5daddb82c60bd75" UNIQUE ("facebookId")`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "gender"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "gender" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "username" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "dateOfBirth"`);
        await queryRunner.query(`CREATE INDEX "IDX_a000cca60bcf04454e72769949" ON "users" ("phone") `);
        await queryRunner.query(`CREATE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_fe0bb3f6520ee0469504521e71" ON "users" ("username") `);
    }

}
