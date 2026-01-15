import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RevertAltTo4kNaming1768492289456 implements MigrationInterface {
  name = 'RevertAltTo4kNaming1768492289456';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`PRAGMA legacy_alter_table = ON`);
    await queryRunner.query(`DROP INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5"`);
    await queryRunner.query(`DROP INDEX "IDX_41a289eb1fa489c1bc6f38d9c3"`);
    await queryRunner.query(`DROP INDEX "IDX_7ff2d11f6a83cb52386eaebe74"`);
    await queryRunner.query(`DROP INDEX "IDX_f926a3b825cc8d5b982f726367"`);
    await queryRunner.query(`ALTER TABLE "media" RENAME TO "temporary_media"`);
    await queryRunner.query(
      `CREATE TABLE "media" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "tmdbId" integer, "tvdbId" integer, "imdbId" varchar, "hcId" integer, "status" integer NOT NULL DEFAULT (1), "status4k" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "lastSeasonChange" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "mediaAddedAt" datetime DEFAULT (CURRENT_TIMESTAMP), "serviceId" integer, "serviceId4k" integer, "externalServiceId" integer, "externalServiceId4k" integer, "externalServiceSlug" varchar, "externalServiceSlug4k" varchar, "ratingKey" varchar, "ratingKey4k" varchar, "jellyfinMediaId" varchar, "jellyfinMediaId4k" varchar, CONSTRAINT "UQ_41a289eb1fa489c1bc6f38d9c3c" UNIQUE ("tvdbId"))`
    );
    await queryRunner.query(
      `INSERT INTO "media"("id", "mediaType", "tmdbId", "tvdbId", "imdbId", "hcId", "status", "status4k", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceId4k", "externalServiceId", "externalServiceId4k", "externalServiceSlug", "externalServiceSlug4k", "ratingKey", "ratingKey4k", "jellyfinMediaId", "jellyfinMediaId4k") SELECT "id", "mediaType", "tmdbId", "tvdbId", "imdbId", "hcId", "status", "statusAlt", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceIdAlt", "externalServiceId", "externalServiceIdAlt", "externalServiceSlug", "externalServiceSlugAlt", "ratingKey", "ratingKeyAlt", "jellyfinMediaId", "jellyfinMediaIdAlt" FROM "temporary_media"`
    );
    await queryRunner.query(`DROP TABLE "temporary_media"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5" ON "media" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_41a289eb1fa489c1bc6f38d9c3" ON "media" ("tvdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7ff2d11f6a83cb52386eaebe74" ON "media" ("imdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f926a3b825cc8d5b982f726367" ON "media" ("hcId") `
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" RENAME TO "temporary_media_request"`
    );
    await queryRunner.query(
      `CREATE TABLE "media_request" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "status" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "type" varchar NOT NULL, "mediaId" integer, "requestedById" integer, "modifiedById" integer, "is4k" boolean NOT NULL DEFAULT (0), "serverId" integer, "profileId" integer, "metadataProfileId" integer, "rootFolder" varchar, "languageProfileId" integer, "tags" text, "isAutoRequest" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_f4fc4efa14c3ba2b29c4525fa15" FOREIGN KEY ("modifiedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_6997bee94720f1ecb7f31137095" FOREIGN KEY ("requestedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a1aa713f41c99e9d10c48da75a0" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "media_request"("id", "status", "createdAt", "updatedAt", "type", "mediaId", "requestedById", "modifiedById", "is4k", "serverId", "profileId", "metadataProfileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest") SELECT "id", "status", "createdAt", "updatedAt", "type", "mediaId", "requestedById", "modifiedById", "isAlt", "serverId", "profileId", "metadataProfileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest" FROM "temporary_media_request"`
    );
    await queryRunner.query(`DROP TABLE "temporary_media_request"`);
    await queryRunner.query(`PRAGMA legacy_alter_table = OFF`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`PRAGMA legacy_alter_table = ON`);
    await queryRunner.query(
      `CREATE TABLE "temporary_media_request" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "status" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "type" varchar NOT NULL, "mediaId" integer, "requestedById" integer, "modifiedById" integer, "isAlt" boolean NOT NULL DEFAULT (0), "serverId" integer, "profileId" integer, "metadataProfileId" integer, "rootFolder" varchar, "languageProfileId" integer, "tags" text, "isAutoRequest" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_f4fc4efa14c3ba2b29c4525fa15" FOREIGN KEY ("modifiedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_6997bee94720f1ecb7f31137095" FOREIGN KEY ("requestedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a1aa713f41c99e9d10c48da75a0" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_media_request"("id", "status", "createdAt", "updatedAt", "type", "mediaId", "requestedById", "modifiedById", "isAlt", "serverId", "profileId", "metadataProfileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest") SELECT "id", "status", "createdAt", "updatedAt", "type", "mediaId", "requestedById", "modifiedById", "is4k", "serverId", "profileId", "metadataProfileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest" FROM "media_request"`
    );
    await queryRunner.query(`DROP TABLE "media_request"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_media_request" RENAME TO "media_request"`
    );
    await queryRunner.query(`DROP INDEX "IDX_f926a3b825cc8d5b982f726367"`);
    await queryRunner.query(`DROP INDEX "IDX_7ff2d11f6a83cb52386eaebe74"`);
    await queryRunner.query(`DROP INDEX "IDX_41a289eb1fa489c1bc6f38d9c3"`);
    await queryRunner.query(`DROP INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_media" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "tmdbId" integer, "tvdbId" integer, "imdbId" varchar, "hcId" integer, "status" integer NOT NULL DEFAULT (1), "statusAlt" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "lastSeasonChange" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "mediaAddedAt" datetime DEFAULT (CURRENT_TIMESTAMP), "serviceId" integer, "serviceIdAlt" integer, "externalServiceId" integer, "externalServiceIdAlt" integer, "externalServiceSlug" varchar, "externalServiceSlugAlt" varchar, "ratingKey" varchar, "ratingKeyAlt" varchar, "jellyfinMediaId" varchar, "jellyfinMediaIdAlt" varchar, CONSTRAINT "UQ_41a289eb1fa489c1bc6f38d9c3c" UNIQUE ("tvdbId"))`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_media"("id", "mediaType", "tmdbId", "tvdbId", "imdbId", "hcId", "status", "statusAlt", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceIdAlt", "externalServiceId", "externalServiceIdAlt", "externalServiceSlug", "externalServiceSlugAlt", "ratingKey", "ratingKeyAlt", "jellyfinMediaId", "jellyfinMediaIdAlt") SELECT "id", "mediaType", "tmdbId", "tvdbId", "imdbId", "hcId", "status", "status4k", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceId4k", "externalServiceId", "externalServiceId4k", "externalServiceSlug", "externalServiceSlug4k", "ratingKey", "ratingKey4k", "jellyfinMediaId", "jellyfinMediaId4k" FROM "media"`
    );
    await queryRunner.query(`DROP TABLE "media"`);
    await queryRunner.query(`ALTER TABLE "temporary_media" RENAME TO "media"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5" ON "media" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_41a289eb1fa489c1bc6f38d9c3" ON "media" ("tvdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7ff2d11f6a83cb52386eaebe74" ON "media" ("imdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f926a3b825cc8d5b982f726367" ON "media" ("hcId") `
    );
    await queryRunner.query(`PRAGMA legacy_alter_table = OFF`);
  }
}
