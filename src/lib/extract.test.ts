// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectArea, extractListing, fromText, fromUrl } from "./extract.ts";

test("reads BHK, area and rent from common portal links", () => {
  assert.deepEqual(fromUrl("https://housing.com/rent/15462330-3-bhk-apartment-in-hinjawadi-for-rs-32000"), {
    bedrooms: 3,
    rent: 32000,
    area: "Hinjewadi",
  });
  assert.deepEqual(fromUrl("https://www.99acres.com/2-bhk-bedroom-apartment-flat-for-rent-in-baner-pune-1050-sq-ft-r4-spid-P1"), {
    bedrooms: 2,
    area: "Baner",
  });
  const nb = fromUrl("https://www.nobroker.in/property/1-bhk-apartment-for-rent-in-wakad-pune-for-rs-17000/abc/detail");
  assert.equal(nb.rent, 17000);
  assert.equal(nb.brokerage, 0);
});

test("reads details from a page's preview text", () => {
  const f = fromText("Semi-furnished 2 BHK Flat for Rent in Viman Nagar for Rs. 28,000 — without brokerage, lift, pet friendly");
  assert.equal(f.bedrooms, 2);
  assert.equal(f.rent, 28000);
  assert.equal(f.furnishing, "semi");
  assert.equal(f.brokerage, 0);
  assert.equal(f.has_lift, true);
  assert.equal(f.pet_friendly, true);
  assert.equal(f.area, "Viman Nagar");
});

test("reads schema.org data and the og:image", () => {
  const html = `<html><head>
    <meta property="og:title" content="3 BHK Apartment for rent in Kothrud | SomeSite">
    <meta property="og:image" content="https://img.example.com/flat.jpg">
    <script type="application/ld+json">{"@type":"Apartment","numberOfRooms":3,"numberOfBathroomsTotal":2,
      "offers":{"price":"36000"},"geo":{"latitude":18.5,"longitude":73.8}}</script>
  </head></html>`;
  const f = extractListing("https://example.com/listing/1", html);
  assert.equal(f.title, "3 BHK Apartment for rent in Kothrud");
  assert.equal(f.rent, 36000);
  assert.equal(f.bathrooms, 2);
  assert.equal(f.area, "Kothrud");
  assert.equal(f.latitude, 18.5);
  assert.equal(f.image_url, "https://img.example.com/flat.jpg");
});

test("blocked pages still get a title and whatever the link gives", () => {
  const f = extractListing("https://www.99acres.com/2-bhk-flat-for-rent-in-aundh-pune-spid-X", null);
  assert.equal(f.title, "2 BHK in Aundh (99acres.com)");
  assert.equal(f.rent, undefined);
});

test("area names are matched as whole words, with alternative spellings", () => {
  assert.equal(detectArea("Flat near Hinjawadi Phase 1"), "Hinjewadi");
  assert.equal(detectArea("Susheel Apartments"), null); // "sus" inside another word doesn't count
});
