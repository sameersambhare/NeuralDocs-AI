from typing import Any


def reciprocal_rank_fusion(
    ranked_lists: list[list[dict[str, Any]]],
    top_k: int,
    rrf_k: int = 60,
) -> list[dict[str, Any]]:
    fused: dict[str, dict[str, Any]] = {}

    for ranked_list in ranked_lists:
        for rank, item in enumerate(ranked_list, start=1):
            chunk_id = str(item["id"])
            score = 1 / (rrf_k + rank)

            if chunk_id not in fused:
                fused[chunk_id] = dict(item)
                fused[chunk_id]["rrf_score"] = 0.0

            fused[chunk_id]["rrf_score"] += score

    results = sorted(fused.values(), key=lambda item: item["rrf_score"], reverse=True)
    return results[:top_k]
