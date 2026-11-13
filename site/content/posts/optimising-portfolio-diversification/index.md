---
title: "Optimising portfolio diversification with a handful of qubits"
date: 2026-11-13
summary: "What if we could tackle a 50-asset portfolio diversification problem with just five qubits? In this post, we explore how Pauli Correlation Encoding (PCE), implemented in OpenQARP, makes this possible."
authors: [vicente-soloviev]
thumb: market-cut
tags: [use-case, finance, optimisation, pce]
---

What if we could tackle a 50-asset portfolio diversification problem with
just five qubits?

In this post, we explore how Pauli Correlation Encoding (PCE), implemented
in OpenQARP, makes this possible. On a simulated market, our five-qubit
approach achieves 98% of the score found by a classical optimisation
algorithm, while using a fraction of the qubits required by conventional
QAOA.

We'll see how the approach works, compare its performance with classical
methods, and explore its potential to tackle much larger problems.

Follow along in the
[accompanying notebook](https://github.com/OpenQARP/openqarp/blob/develop/examples/use_cases/finance_portfolio_diversification.ipynb).

## The problem

Diversification is one piece of investing advice that holds up under
almost any market condition: don't put all your money into assets that are
likely to fall together. The principle is simple enough. The hard part is
turning it into a list of names to buy.

One approach is to create groups of assets that behave differently from
one another. For example, rather than grouping technology stocks together,
we might combine them with commodities or utilities that respond to
different market forces. Each group then becomes a potential diversified
portfolio.

The mathematical foundations of portfolio diversification go back to Harry
Markowitz's mean-variance optimisation in 1952. His key insight was that
portfolio risk depends not just on the individual investments, but on how
their returns move in relation to one another. Assets with a strong
positive correlation tend to rise and fall together, while those with low
or negative correlations behave more independently or move in opposite
directions.

We can use these relationships to represent the market as a graph. Each
asset becomes a node, and the correlations between assets become weighted
connections, or edges, linking those nodes. We can then use a
graph-partitioning algorithm to divide the assets into two groups. The
objective is to maximise the total weight of the connections crossing
between them. In other words, we want strongly positively correlated
assets to end up on opposite sides of the split, rather than together in
the same group.

This is a formidable optimisation problem. Even with just 50 assets, there
are more than 500 trillion different ways to split them into two groups,
clearly too many to evaluate individually. Classical optimisation
algorithms can search for good solutions without checking every
possibility, but finding the best solution can be much harder. The problem
is a natural candidate for a quantum computing solution.

But there's a catch. The conventional quantum approach to graph
partitioning, the Quantum Approximate Optimisation Algorithm (QAOA),
requires one qubit for every asset. Real-world investment universes can
contain hundreds or thousands of assets, pushing the requirements beyond
the capabilities of today's quantum hardware. We would quickly run out of
qubits.

In this post, we'll explore a different approach using Pauli Correlation
Encoding (PCE), implemented in OpenQARP. Instead of assigning a separate
qubit to each asset, PCE encodes information about multiple assets across
a small number of qubits. This allows us to represent the full 50-asset
problem using just five qubits, with the potential to extend the approach
to much larger problems.

To see how it works, we'll start with a small eight-asset example using
conventional QAOA, where we can check the result against an exact
solution. Then we'll scale up to the full 50-asset market using PCE and
compare the results with classical optimisation.

## Building a market graph

We first need some market data. Rather than use real stock prices, we'll
create a simulated market of 50 assets across five sectors: technology
(TECH), energy (ENRG), finance (FINL), healthcare (HLTH) and gold (GOLD).
Each asset's daily return is a small shared market factor, plus a
per-sector factor shared by every ticker in that sector, plus its own
idiosyncratic noise:

```python
market_factor = rng.normal(0.0003, 0.006, N_DAYS)
for sector, cfg in SECTORS.items():
    sector_factor = rng.normal(0.0, cfg["sector_vol"], N_DAYS)
    for i in range(cfg["n_assets"]):
        idio = rng.normal(0.0, cfg["idio_vol"], N_DAYS)
        r = cfg["beta"] * market_factor + sector_factor + idio
        # r is this asset's simulated daily-return series
```

That per-sector shared factor is doing the work on purpose: it's what
makes same-sector pairs correlate at ~0.8 while cross-sector pairs
stay near zero, so the resulting market has an obvious cluster structure
to recover. It is a synthetic stand-in for the kind of correlation
structure a real market exhibits, built deliberately clean so the result
can be checked by eye.

**This step only exists because the example has no dataset to load.** If
you are working from real data, a CSV of daily prices or returns for your
own universe, start here instead: skip the simulation above entirely and
build a `returns_df` (one column per ticker) from your own data.
Everything from this point on, including the market graph, only ever
depends on that DataFrame of returns, not on how it was produced.

With `returns_df` in hand, simulated or real, the pairwise return
correlation matrix *is* a graph: nodes are assets, edge weights are
correlations. Compute the correlations and keep only pairs above a
threshold, both to keep the Hamiltonian smaller and to prune sampling
noise:

```python
# returns_df: one column per ticker, one row per trading day/period
def build_market_graph(returns_df, threshold=0.15):
    corr = returns_df.corr()
    cols = list(returns_df.columns)
    graph = Graph()
    graph.add_nodes_from(range(len(cols)))
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            w = corr.iloc[i, j]
            if abs(w) >= threshold:
                graph.add_edge(i, j, weight=float(w))
    return graph, cols, corr
```

**A sanity check before optimising anything.** The synthetic market was
built from five independent sector factors, so thresholding should have
recovered exactly those five sectors as disconnected pieces of the graph.
This is a property of the *raw* correlation graph, before any
partitioning runs, and it's worth checking rather than assuming:

```python
>>> [len(c) for c in nx.connected_components(market_graph)]
[12, 10, 10, 10, 8]
```

Those five sizes are exactly the five `n_assets` values in `SECTORS`:
TECH (12), ENRG (10), FINL (10), HLTH (10), GOLD (8). Each component's
tickers are a single sector with no cross-sector edges at all. The
threshold didn't approximately separate the sectors; at `threshold=0.15`
it separated them exactly, which is what makes `market_graph` "five
disjoint near-cliques, one per sector" more than a figure of speech.

That is *not* what graph partitioning produces, and the distinction
matters. Maximising the cut on this graph pushes strongly correlated pairs
onto opposite sides, since separating them is what earns the objective the
most weight. Weakly- or negatively-correlated pairs are cheap to leave
together. The side that comes out with the *lower* average internal
correlation is the diversified basket. Graph partitioning only guarantees
that the total correlation left uncut is small, not that it splits evenly
between the two sides, so which side is "diversified" is read off after
the fact rather than assumed.

One run of this optimisation, whichever encoding solves it, returns
exactly one two-way split: a diversified basket and everything else as its
complement. Both examples below run the optimiser once and stop. Getting
more than two clusters out of the market isn't a setting to change on a
single run. It means treating one side of the split as its own smaller
universe and running the same optimisation on it again, and again:
recursive bipartition, not a single run with more cluster labels.

## A toy market: eight assets, one qubit per name

Before the full market, a toy version of it. A toy market is a cut-down
universe small enough to solve exactly, so we can check that the quantum
method finds the true answer before trusting it at a size where no exact
answer exists. Here it is two tickers from each of four sectors: small
enough that the 2^8 = 256 candidate partitions can be brute-forced for an
independent reference, so QAOA's answer can be checked against the true
optimum rather than just trusted.

```python
qaoa = QAOA(
    problem=toy_graph,
    n_layers=3,
    use_rzz=True,
    initial_parameters=[0.3] * 6,
).build()
fun, x = qaoa.run()
```

One qubit per asset: eight assets, eight qubits. Each qubit's measured
value (0 or 1) is just which side of the cut that asset lands on. This is
a direct binary encoding, not a one-hot one (one-hot would spend a qubit
per *category* rather than per decision, and a two-way split only has one
decision per asset).

Sampling the optimised circuit and reading off the most likely bitstring
gives a partition, which splits into a diversified basket and its
complement the same way the full-scale run below does:

```python
circ = deepcopy(qaoa.get_final_state_block())
circ.measure([(q, q) for q in range(circ.n_qubits)])

sampler = Sampler(ket=circ, n_shots=10_000)
engine = QarpEngine(seed=42)
engine.build([sampler]); engine.run({})

qaoa_bits = list(max(sampler.result, key=sampler.result.get))
div_idx, comp_idx, div_c, comp_c = diversified_and_complement(toy_corr, qaoa_bits)
```

**QAOA vs. the brute-force optimum**

| | cut value |
|---|---|
| Brute-force optimum (256 partitions) | 3.161 |
| QAOA (sampled) | 3.161 |

Both the brute-force search over all 256 partitions and QAOA's sampled
best answer land on a cut value of **3.161**, a ratio of 1.00. On this toy
graph, the quantum approach found the exact answer, not an approximation
of it.

**Mean pairwise correlation, diversified basket vs. baselines**

| | mean pairwise correlation |
|---|---|
| Whole toy universe | 0.106 |
| Random 4-asset draw | 0.105 |
| QAOA diversified basket (TECH02, ENRG02, FINL02, GOLD01) | -0.016 |

The four-asset basket QAOA found has slightly *negative* average
correlation, against ~0.11 for the whole toy universe and for a
random four-asset draw of the same size.

{{< figure src="toy-correlation.png" width="520" alt="Toy market: 8 by 8 correlation matrix, rows and columns reordered so the diversified basket sits in the top-left block and its complement in the bottom-right." caption="Correlation matrix of the toy market, rows and columns reordered by the cut: diversified basket top-left, complement bottom-right." >}}

Each sector contributes one strongly correlated pair (TECH, ENRG, FINL,
GOLD: the ~0.8 off-diagonal entries). The cut puts one member of
every pair in the diversified block (top-left) and the other in its
complement (bottom-right). Each correlated pair gets split, which is
exactly what a 2-colouring of four disjoint pairs can do and no more.

## Scaling to fifty assets: more assets than qubits

Now the full market. This section swaps the encoding, not the problem:
the market graph and the objective stay the same, and a different way of
reading decisions off the qubits brings the circuit down from fifty to
five.

One qubit per asset does not survive contact with the full market: fifty
binary decision variables need fifty qubits under that encoding.
[PCE](https://arxiv.org/abs/2511.21305) (Pauli Correlation Encoding) takes
a different approach. Instead of one variable per qubit, it reads each
variable off a higher-order Pauli correlator (a weight-*k* string of Z, X,
Y) measured on a shared pool of qubits. More correlators fit on the same
handful of qubits than there are qubits, so the resource that has to grow
with the universe is the number of measured correlators, not the circuit
width.

```python
order = 3
n_qubits = calculate_qubits(N_ASSETS, order, merging=True)
# 50 assets, order=3 Pauli correlators, merging=True -> n_qubits = 5
```

Both encodings solve the identical objective on the identical market
graph. One scales one-to-one with the number of assets; the other scales
with the correlator order instead. And that order is a knob, not a fixed
cost: raising it from 3 to 5 trades more measured correlators per qubit
for an even flatter qubit count as the universe grows.

{{< figure src="qubits-vs-assets.png" alt="Line chart of qubits needed versus number of assets, on a log scale, for four encodings: one qubit per asset in red, reaching 1000 qubits at 1000 assets, and PCE at order 2, 3 and 5 with merging in light to dark blue, all staying under 30 qubits out to 1000 assets. A dashed vertical line marks this example's 50-asset case, where one qubit per asset needs 50 qubits and PCE order 3 needs 5." caption="Qubits needed against the number of assets. PCE at order 2, 3 and 5 in light to dark blue (higher order, fewer qubits) against one qubit per asset in red." >}}

At this example's own size, 50 assets, order 3 and order 5 both land on 5
qubits (order 2 needs 6). The gap between orders only opens up as the
universe grows past a few hundred names, which is also exactly where
one-qubit-per-asset becomes hopeless on real hardware.

The same `HEABlock` ansatz and `.build()` and `.run()` pattern as QAOA
runs the optimisation. Because each circuit only touches five qubits,
several random restarts cost seconds rather than minutes, which matters
since PCE's optimisation landscape is non-convex:

```python
he_wfn = HEABlock(n_qubits, 3, True, True, True, False).build()
pce = PCE(
    graph=market_graph, order=order, ket=he_wfn,
    primitive=Sampler(), merging=True,
    optimizer=ScipyOptimizer("COBYQA"),
    engine=QarpEngine(seed=1000 + restart_index),
).build()
_, _, sol = pce.run()
```

Ten restarts, best objective kept: ten seeded engines, five qubits each.

## What the cut finds at full scale

Exhaustive search is off the table at fifty nodes, so the independent
references change shape. A greedy local-search heuristic (repeated
single-asset flips from twenty random starts) stands in for "the best a
classical method finds cheaply", and the average cut of a purely random
balanced split stands in for "no optimisation at all".

**Graph partitioning objective (total correlation separated by the cut)**

| method | objective |
|---|---|
| Random split | 94.0 |
| PCE, 5 qubits (best of 10 restarts) | 102.2 |
| Greedy local search (classical) | 103.8 |

Best of ten restarts, computed, together with both classical benchmarks
above it, in about nine seconds total. PCE's five-qubit answer reaches 98% of
the classical greedy heuristic's objective, well clear of an unoptimised
random split.

**Mean pairwise correlation**

| | mean pairwise correlation |
|---|---|
| Whole universe (50 assets) | 0.153 |
| Random 25-asset draw | 0.153 |
| PCE diversified cluster (25 assets) | 0.139 |

**Annualised volatility, equal-weight**

| | annualised volatility |
|---|---|
| Random baskets (avg. of 200 draws) | 9.67% |
| PCE diversified basket | 9.32% |

**Sector spread.** The diversified cluster draws from all five sectors
(TECH 6, HLTH 6, ENRG 5, FINL 4, GOLD 4) rather than collapsing onto one.
It isn't just "everything except tech"; it's a basket built from the
correlation structure, not from sector labels the algorithm never saw.
This is the mirror image of the connected-components check earlier: the
*raw* graph's components are exactly the five sectors, but graph
partitioning's job is to break each of those sector-cliques apart as
evenly as possible, not to rediscover them. A basket that recovered the
sectors intact would be the opposite of diversified.

## What this does and doesn't show

The market here is synthetic and the engine runs an ideal (noiseless)
simulation with a fixed seed. This demonstrates the pipeline and checks it
against independent references; it does not benchmark live market data or
real quantum hardware. Every number above was checked against something
that isn't the algorithm's own output: brute force for the toy case, a
classical heuristic and a random baseline at full scale. Round-trip
agreement with itself would not have been enough.

The diversification benefit from a single two-way split is real but modest
by construction: graph partitioning only 2-colours a same-sector clique,
so it separates roughly half of each sector's internal redundancy, not all
of it. As noted above, both examples here stop at one split. Pushing
further, with many clusters via the recursive bipartition described
earlier, streamed over a rolling backtest, or with a continuation scheme
like `qarp.algorithms.iterativePCE`, is the natural next step.

## Going beyond one split: recursive bipartition

Neither example above goes past one split, but nothing about the pipeline
is specific to stopping there. Treat each resulting cluster as its own
smaller market, its own induced subgraph of the correlation graph, and run
the same optimisation on it again. Each call is independent of the others,
so the same `.build().run()` step from before just gets called once per
cluster, at whatever qubit count that cluster's own size calls for:

```python
def recursive_bipartition(nodes, depth, min_size=4):
    clusters = [nodes]
    for _level in range(depth):
        next_clusters = []
        for cluster in clusters:
            if len(cluster) < min_size:
                next_clusters.append(cluster)  # too small to split further
                continue
            subgraph = induced_correlation_graph(cluster)  # build_market_graph, restricted
            n_qubits = calculate_qubits(len(cluster), order, merging=True)
            left, right = run_pce(subgraph, n_qubits)  # one more PCE optimisation
            next_clusters += [left, right]
        clusters = next_clusters
    return clusters
```

Running this two levels deep on the same fifty-asset market (split the
market in two, then split each half again) gives four clusters instead of
two, and the qubit budget per call shrinks along with the cluster:

| level | split | qubits used |
|---|---|---|
| 0 (whole market, 50 assets) | 50 → 24 / 26 | 5 |
| 1 (each 25-asset half) | 24 → 12 / 12, 26 → 13 / 13 | 4 |

**The four resulting clusters**

| cluster | size | mean pairwise correlation | sector mix (TECH / ENRG / FINL / HLTH / GOLD) |
|---|---|---|---|
| A | 12 | 0.134 | 4 / 1 / 2 / 3 / 2 |
| B | 12 | 0.114 | 2 / 3 / 3 / 2 / 2 |
| C | 13 | 0.134 | 3 / 4 / 2 / 3 / 1 |
| D | 13 | 0.112 | 3 / 2 / 3 / 2 / 3 |

Averaged across the four, mean pairwise correlation comes to **0.124**,
lower than either side of the single two-way split (0.139 / 0.143), and
well below the 0.153 whole-universe baseline. That's the expected
direction: a second round of splitting has more freedom to separate
residual same-sector pairs that a single cut had to leave bundled
together. None of the four clusters collapses onto one sector, so the
extra structure is coming from correlation, not from rediscovering the
sector labels.

## What have we learned?

Portfolio diversification gives us a useful example of how quantum
optimisation can tackle complex problems. By representing correlations
between assets as a weighted graph, we can use the same graph-partitioning
approach for both our small eight-asset example and the full 50-asset
market.

The real breakthrough here is in how we encode the problem. Conventional
QAOA requires one qubit per asset, but Pauli Correlation Encoding (PCE)
allows us to represent multiple assets using a much smaller number of
qubits. In our simulated market, we reduced the requirement from 50 qubits
to just five, while achieving 98% of the objective score found by a
classical optimisation heuristic.

This isn't evidence of a quantum advantage. Our results come from an ideal
simulator, and the classical method still achieves a slightly better
score. But they demonstrate something important: by changing how we encode
optimisation problems, we can dramatically reduce their qubit requirements
without sacrificing much solution quality.

That's a promising direction for tackling larger optimisation problems
with the quantum hardware available today, and potentially much larger
problems in the future.

## References

- Vicente P. Soloviev, Michal Krompiec,
  ["Large-scale portfolio optimization using Pauli Correlation Encoding"](https://arxiv.org/abs/2511.21305),
  arXiv:2511.21305. The source paper for the PCE algorithm used above.
- Vicente P. Soloviev, Antonio Márquez Romero, Josh Kirsopp, Michal
  Krompiec,
  ["Scaling Portfolio Diversification with Quantum Circuit Cutting Techniques"](https://arxiv.org/abs/2506.08947),
  arXiv:2506.08947. Circuit cutting applied to the same portfolio-diversification
  problem, solved with graph partitioning.
- Jacobo Padín-Martínez, Vicente P. Soloviev, Alejandro Borrallo-Rentero,
  Antón Rodríguez-Otero, Raquel Alfonso-Rodríguez, Michal Krompiec,
  ["Progressive Binarization - Pauli Correlation Encoding: a Continuation Method for Constrained Optimization"](https://arxiv.org/abs/2602.17479),
  arXiv:2602.17479. The iterative-alpha continuation scheme behind
  `iterativePCE`.

Full code and checks: the
[portfolio diversification notebook](https://github.com/OpenQARP/openqarp/blob/develop/examples/use_cases/finance_portfolio_diversification.ipynb)
in the OpenQARP repository.
