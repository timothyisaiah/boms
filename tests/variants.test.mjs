import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("variants create products atomically, preserve identity and audit management changes", async () => {
  const db = new PGlite(),
    actor = randomUUID();
  try {
    for (const file of readdirSync("neon/migrations").sort())
      await db.exec(readFileSync(`neon/migrations/${file}`, "utf8"));
    await db.query(
      "insert into users(id,email,password_hash,app_role) values($1,'variants@example.invalid','test-only','admin_owner')",
      [actor],
    );
    const run = (body, key = randomUUID()) =>
      db.transaction(async (tx) => {
        await tx.query("select set_config('boms.actor_id',$1,true)", [actor]);
        const hash = createHash("sha256")
          .update(
            JSON.stringify(
              Object.keys(body)
                .sort()
                .reduce((acc, k) => ({ ...acc, [k]: body[k] }), {}),
            ),
          )
          .digest("hex");
        return (
          await tx.query("select * from execute_variant_save($1,$2,$3)", [
            key,
            hash,
            body,
          ])
        ).rows[0];
      });
    const firstVariant = {
      productId: null,
      newProductName: "Beecone Classic Honey",
      newProductDescription: "Natural honey range",
      sku: " HNY-500-CL ",
      variantName: "Classic honey 500g",
      flavor: "Classic",
      packSizeGrams: 500,
      packagingType: "Glass jar",
      lowStockThreshold: 12,
      isActive: true,
    };
    const key = randomUUID(),
      created = await run(firstVariant, key);
    assert.equal(created.response_status, 201);
    assert.deepEqual(await run(firstVariant, key), created);
    const variantId = created.response_body.id,
      productId = created.response_body.productId;
    const [product] = (
      await db.query("select * from products where id=$1", [productId])
    ).rows;
    assert.equal(product.name, "Beecone Classic Honey");
    assert.equal(product.slug, "beecone-classic-honey");
    const [variant] = (
      await db.query("select * from product_variants where id=$1", [variantId])
    ).rows;
    assert.equal(variant.sku, "HNY-500-CL");
    assert.equal(variant.low_stock_threshold, 12);
    assert.equal(
      (await run({ ...firstVariant, sku: "HNY-250-CL" }, key)).response_status,
      409,
    );
    assert.equal(
      (await run({ ...firstVariant, sku: "hny-500-cl" })).response_status,
      409,
    );
    assert.equal(
      (await run({ ...firstVariant, sku: "HNY-250-CL" })).response_status,
      409,
      // The product already exists, so an explicit product selection is required.
    );

    const second = await run({
      ...firstVariant,
      productId,
      newProductName: "",
      newProductDescription: "",
      sku: "HNY-250-CL",
      variantName: "Classic honey 250g",
      packSizeGrams: 250,
    });
    assert.equal(second.response_status, 201);
    const update = {
      ...firstVariant,
      id: variantId,
      productId,
      newProductName: "",
      newProductDescription: "",
      sku: "HNY-500-CLASSIC",
      variantName: "Classic honey 500 gram jar",
      packagingType: "Squeeze bottle",
      lowStockThreshold: 20,
      isActive: false,
    };
    const updateKey = randomUUID(),
      saved = await run(update, updateKey);
    assert.equal(saved.response_status, 200);
    assert.deepEqual(await run(update, updateKey), saved);
    const [updated] = (
      await db.query("select * from product_variants where id=$1", [variantId])
    ).rows;
    assert.deepEqual(
      {
        sku: updated.sku,
        variant_name: updated.variant_name,
        packaging_type: updated.packaging_type,
        low_stock_threshold: updated.low_stock_threshold,
        is_active: updated.is_active,
        product_id: updated.product_id,
      },
      {
        sku: "HNY-500-CLASSIC",
        variant_name: "Classic honey 500 gram jar",
        packaging_type: "Squeeze bottle",
        low_stock_threshold: 20,
        is_active: false,
        product_id: productId,
      },
    );
    const anotherProduct = await db.query(
      "insert into products(name,slug) values('Other honey','other-honey') returning id",
    );
    await assert.rejects(
      run({ ...update, productId: anotherProduct.rows[0].id }),
      /cannot move to another product/,
    );
    await assert.rejects(run({ ...update, packSizeGrams: 0 }), /pack size/);
    await assert.rejects(
      run({ ...update, lowStockThreshold: -1 }),
      /nonnegative threshold/,
    );
    await assert.rejects(
      run({ ...update, id: 999999, sku: "MISSING-SKU" }),
      /no longer exists/,
    );
    const audits = (
      await db.query(
        "select * from variant_profile_audits where variant_id=$1 order by id",
        [variantId],
      )
    ).rows;
    assert.equal(audits.length, 2);
    assert.equal(audits[0].previous_profile, null);
    assert.equal(audits[1].previous_profile.sku, "HNY-500-CL");
    assert.equal(audits[1].new_profile.is_active, false);
    assert.equal(
      (await db.query("select count(*)::int n from audit_logs")).rows[0].n,
      4,
    );

    for (const role of [
      "production_staff",
      "warehouse_staff",
      "sales_or_distribution_staff",
      "finance_accountant",
      "read_only_management",
    ]) {
      await db.query("update users set app_role=$1 where id=$2", [role, actor]);
      await assert.rejects(run(update), /role cannot manage variants/);
    }
    await db.query("update users set app_role=$1 where id=$2", [
      "operations_manager",
      actor,
    ]);
    assert.equal(
      (await run({ ...update, isActive: true })).response_status,
      200,
    );
  } finally {
    await db.close();
  }
});
