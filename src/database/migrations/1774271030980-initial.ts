import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1774271030980 implements MigrationInterface {
    name = 'Initial1774271030980'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_0041a1a05dc7dc46e0b50619a7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_63b892669b926fe755b7579941"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4d3790479b4ace0798f7d54c55"`);
        await queryRunner.query(`ALTER TABLE "post_tags" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "post_tags" DROP COLUMN "postId"`);
        await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "caption"`);
        await queryRunner.query(`ALTER TABLE "saved_posts" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "saved_posts" DROP COLUMN "postId"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "showSuggestions" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "post_tags" DROP CONSTRAINT "FK_4ae64c1a280535113e8b7a66e54"`);
        await queryRunner.query(`ALTER TABLE "post_tags" DROP CONSTRAINT "FK_5df4e8dc2cb3e668b962362265d"`);
        await queryRunner.query(`ALTER TABLE "post_tags" ALTER COLUMN "user_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "post_tags" ALTER COLUMN "post_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "posts" DROP CONSTRAINT "FK_c4f9a7bd77b489e711277ee5986"`);
        await queryRunner.query(`ALTER TABLE "posts" ALTER COLUMN "user_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "saved_posts" DROP CONSTRAINT "FK_78c961371a509e86d789714dd4f"`);
        await queryRunner.query(`ALTER TABLE "saved_posts" DROP CONSTRAINT "FK_116e9df57f5221cc1a77c3d1cfe"`);
        await queryRunner.query(`ALTER TABLE "saved_posts" ALTER COLUMN "user_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "saved_posts" ALTER COLUMN "post_id" SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_0af861616219606ea6f610b3f8" ON "post_tags" ("user_id", "post_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_300215aa4b0de9f1d5111678ed" ON "posts" ("user_id", "createdAt", "id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_837a562f71fec3009c9af77ee5" ON "saved_posts" ("user_id", "post_id") `);
        await queryRunner.query(`ALTER TABLE "post_tags" ADD CONSTRAINT "FK_4ae64c1a280535113e8b7a66e54" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post_tags" ADD CONSTRAINT "FK_5df4e8dc2cb3e668b962362265d" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "posts" ADD CONSTRAINT "FK_c4f9a7bd77b489e711277ee5986" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "saved_posts" ADD CONSTRAINT "FK_78c961371a509e86d789714dd4f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "saved_posts" ADD CONSTRAINT "FK_116e9df57f5221cc1a77c3d1cfe" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "saved_posts" DROP CONSTRAINT "FK_116e9df57f5221cc1a77c3d1cfe"`);
        await queryRunner.query(`ALTER TABLE "saved_posts" DROP CONSTRAINT "FK_78c961371a509e86d789714dd4f"`);
        await queryRunner.query(`ALTER TABLE "posts" DROP CONSTRAINT "FK_c4f9a7bd77b489e711277ee5986"`);
        await queryRunner.query(`ALTER TABLE "post_tags" DROP CONSTRAINT "FK_5df4e8dc2cb3e668b962362265d"`);
        await queryRunner.query(`ALTER TABLE "post_tags" DROP CONSTRAINT "FK_4ae64c1a280535113e8b7a66e54"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_837a562f71fec3009c9af77ee5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_300215aa4b0de9f1d5111678ed"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0af861616219606ea6f610b3f8"`);
        await queryRunner.query(`ALTER TABLE "saved_posts" ALTER COLUMN "post_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "saved_posts" ALTER COLUMN "user_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "saved_posts" ADD CONSTRAINT "FK_116e9df57f5221cc1a77c3d1cfe" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "saved_posts" ADD CONSTRAINT "FK_78c961371a509e86d789714dd4f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "posts" ALTER COLUMN "user_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "posts" ADD CONSTRAINT "FK_c4f9a7bd77b489e711277ee5986" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post_tags" ALTER COLUMN "post_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "post_tags" ALTER COLUMN "user_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "post_tags" ADD CONSTRAINT "FK_5df4e8dc2cb3e668b962362265d" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post_tags" ADD CONSTRAINT "FK_4ae64c1a280535113e8b7a66e54" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "showSuggestions"`);
        await queryRunner.query(`ALTER TABLE "saved_posts" ADD "postId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "saved_posts" ADD "userId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "posts" ADD "caption" character varying`);
        await queryRunner.query(`ALTER TABLE "posts" ADD "userId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "post_tags" ADD "postId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "post_tags" ADD "userId" character varying NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4d3790479b4ace0798f7d54c55" ON "saved_posts" ("userId", "postId") `);
        await queryRunner.query(`CREATE INDEX "IDX_63b892669b926fe755b7579941" ON "posts" ("id", "createdAt", "userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0041a1a05dc7dc46e0b50619a7" ON "post_tags" ("userId", "postId") `);
    }
}