import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1776073023049 implements MigrationInterface {
  name = 'Initial1776073023049';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0af861616219606ea6f610b3f8"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."post_media_type_enum" AS ENUM('image', 'video')`,
    );
    await queryRunner.query(
      `CREATE TABLE "post_media" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "post_id" uuid NOT NULL, "key" text NOT NULL, "type" "public"."post_media_type_enum" NOT NULL, "order" integer NOT NULL, CONSTRAINT "PK_049edb1ce7ab3d2a98009b171d0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1a3accdc1fa7bab8da9084b4fe" ON "post_media" ("post_id", "order") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1eeb54a4fdfbe9db17899243cb" ON "post_media" ("post_id") `,
    );
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "imageUrl"`);
    await queryRunner.query(
      `ALTER TABLE "posts" ADD "caption" character varying(2200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" ADD "mediaCount" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0af861616219606ea6f610b3f8" ON "post_tags" ("user_id", "post_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "post_media" ADD CONSTRAINT "FK_1eeb54a4fdfbe9db17899243cbe" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post_media" DROP CONSTRAINT "FK_1eeb54a4fdfbe9db17899243cbe"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0af861616219606ea6f610b3f8"`,
    );
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "mediaCount"`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "caption"`);
    await queryRunner.query(
      `ALTER TABLE "posts" ADD "imageUrl" character varying NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1eeb54a4fdfbe9db17899243cb"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1a3accdc1fa7bab8da9084b4fe"`,
    );
    await queryRunner.query(`DROP TABLE "post_media"`);
    await queryRunner.query(`DROP TYPE "public"."post_media_type_enum"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_0af861616219606ea6f610b3f8" ON "post_tags" ("user_id", "post_id") `,
    );
  }
}
