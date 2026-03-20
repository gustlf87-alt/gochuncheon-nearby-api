module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method Not Allowed"
    });
  }

  const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY;

  if (!KAKAO_REST_KEY) {
    return res.status(500).json({
      ok: false,
      error: "KAKAO_REST_KEY is not configured."
    });
  }

  async function kakaoFetch(url) {
    const response = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${KAKAO_REST_KEY}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Kakao API ${response.status}: ${text}`);
    }

    return response.json();
  }

  async function resolveCoords({ lat, lng, address, title }) {
    if (lat && lng) {
      return {
        lat: Number(lat),
        lng: Number(lng),
        source: "provided_coords"
      };
    }

    if (address) {
      const addrUrl = new URL("https://dapi.kakao.com/v2/local/search/address.json");
      addrUrl.searchParams.set("query", address);

      const addrData = await kakaoFetch(addrUrl);
      const first = addrData.documents?.[0];

      if (first?.y && first?.x) {
        return {
          lat: Number(first.y),
          lng: Number(first.x),
          source: "address_geocode"
        };
      }
    }

    if (title) {
      const keywordUrl = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
      keywordUrl.searchParams.set("query", `춘천 ${title}`);
      keywordUrl.searchParams.set("size", "5");

      const keywordData = await kakaoFetch(keywordUrl);
      const first = keywordData.documents?.[0];

      if (first?.y && first?.x) {
        return {
          lat: Number(first.y),
          lng: Number(first.x),
          source: "keyword_search"
        };
      }
    }

    throw new Error("Could not resolve coordinates for this location.");
  }

  function mapNearbyItem(place, type) {
    return {
      name: place.place_name,
      signature_menu: type === "cafe" ? "카페" : "식당",
      distance_km: place.distance ? Number(place.distance) / 1000 : null,
      note: place.category_name || "",
      map_query: place.place_name,
      address: place.road_address_name || place.address_name || "",
      public_transport: "",
      parking: false,
      pet_allowed: false,
      phone: place.phone || "",
      place_url: place.place_url || "",
      category_name: place.category_name || ""
    };
  }

  try {
    const {
      lat,
      lng,
      address = "",
      title = "",
      type = "cafe",
      radius = "2000",
      size = "10"
    } = req.query;

    const coords = await resolveCoords({ lat, lng, address, title });
    const categoryGroupCode = type === "food" ? "FD6" : "CE7";

    const url = new URL("https://dapi.kakao.com/v2/local/search/category.json");
    url.searchParams.set("category_group_code", categoryGroupCode);
    url.searchParams.set("x", String(coords.lng));
    url.searchParams.set("y", String(coords.lat));
    url.searchParams.set("radius", String(radius));
    url.searchParams.set("sort", "distance");
    url.searchParams.set("size", String(size));

    const data = await kakaoFetch(url);
    const items = (data.documents || []).map((place) => mapNearbyItem(place, type));

    return res.status(200).json({
      ok: true,
      source: "kakao_local",
      type,
      resolved_from: coords.source,
      center: coords,
      count: items.length,
      items
    });
  } catch (error) {
    console.error("nearby.js error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message || "Nearby lookup failed."
    });
  }
};
