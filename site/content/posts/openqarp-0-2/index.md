---
title: "OpenQARP 0.2.0: new algorithms, faster simulation and improved developer tools"
date: 2026-11-20
summary: "OpenQARP 0.2.0 is on PyPI. The simulator reads the structure of a circuit and runs each piece as the cheapest exact kernel, quantum-selected configuration interaction joins the algorithms, sampling results become objects, and the compiled backend ships with type stubs. Every number in this post comes from running the released wheels."
authors: [stefano-scali]
thumb: kernels
tags: [news, release, simulation, chemistry]
---

The first big update to OpenQARP since the launch is here.

```shell
pip install -U openqarp
```

Version 0.2.0 brings two new quantum algorithms, faster simulation and new
tools for sampling analysis and application development.

This release has been shaped by feedback from the growing number of people
using OpenQARP since its launch. Your experiences and suggestions are
helping us extend the framework and make it more useful for the research
community.

In this post we go through the new features, show how they work with code
examples and benchmarks, and explain what existing users need to know when
upgrading from version 0.1.

## What's new in OpenQARP 0.2.0

- **A new algorithm, QSCI.** Quantum-selected configuration interaction
  samples a prepared state, keeps the configurations that carry the weight
  and diagonalises the Hamiltonian exactly in that subspace.
- **GPU-accelerated quantum Monte Carlo.** The semiclassical Monte Carlo
  evolution with aggregated walkers and matrix elements computed on the
  GPU, with no measurement circuits.
- **Faster simulation through structured execution.** The simulator
  recognises the structure of a circuit and runs each piece as the
  cheapest exact kernel instead of gate by gate.
- **Simpler sampling analysis.** Sampling results come back as a
  `SamplingDistribution`, with the statistics and comparisons you would
  otherwise write by hand.
- **Improved developer tools.** The compiled core ships with type stubs,
  so editors complete and type checkers check calls into it.

These come with performance improvements, bug fixes and refinements across
the framework. The full list of changes is in the
[changelog](https://github.com/OpenQARP/openqarp/blob/main/CHANGELOG.md).
The timings below come from one script run on the 0.1.1 and 0.2.0 wheels
on the same laptop, best of five.

## A new algorithm: QSCI

Quantum-selected configuration interaction samples a prepared state in the
computational basis, keeps the most frequently observed electron
configurations, and diagonalises the Hamiltonian exactly in the subspace
they span
([Kanno et al., 2023](https://arxiv.org/abs/2302.11320)).
The circuit's job is to put weight on the right configurations. The energy
comes from a classical diagonalisation, so it is variational.

`qarp.algorithms.QSCI` takes the state in three forms: one block; a
sequence of blocks, each sampled with the same number of shots and pooled
with equal weight, which for equally spaced times is the time-averaged
TE-QSCI of
[Mikkelsen and Nakagawa, 2024](https://arxiv.org/abs/2412.13839);
or a `distribution` gathered elsewhere, the route for samples from
hardware. `max_subspace_dim` and `prob_threshold` bound the selection,
`n_electrons` names the sector, and `n_roots` sets how many eigenpairs
`run()` returns.

The example in the repository is N<sub>2</sub> with the bond stretched to
2.5 Å, far past the 1.10 Å equilibrium, in a 6-electron, 6-orbital active
space: 12 qubits and 400 configurations in the sector. The broken triple
bond spreads the ground state over many determinants, and Hartree-Fock
sits 0.817 Ha above CASCI. Each block below prepares Hartree-Fock and
applies one Trotter step of e<sup>-iHt</sup>.

```python
from qarp.algorithms import QSCI, Sampler
from qarp.blocks import CompositeBlock, MappedONVStateBlock, TrotterBlock
from qarp.engines import QarpEngine
from qarp.operators import JordanWigner

times = [0.5, 1.0, 1.5, 2.0]
blocks = [
    CompositeBlock([
        MappedONVStateBlock(hf_onv, JordanWigner()),
        TrotterBlock(n_qubits, qubit_hamiltonian, steps=1, time=t),
    ])
    for t in times
]

qsci = QSCI(
    hamiltonian,
    ket=blocks,
    primitive=Sampler(n_shots=2000),
    engine=QarpEngine(seed=42),
    n_electrons=n_electrons,
).build()
energies, coefficients = qsci.run()
```

On 0.2.0 the pooled 8,000 shots select 87 of the 400 configurations, and
the lowest eigenvalue lands 1.0 mHa above CASCI. A UCCSD state optimised
with VQE sits 14 mHa above CASCI, and QSCI on 2,000 samples of that state
gives 3.6 mHa from 83 configurations. The pooled samples stay on
`qsci.distribution`, so the usual energy-against-subspace-size curve
re-selects from one sample set with no further circuit runs.

{{< figure src="qsci.png" width="560" alt="Time-averaged QSCI error against CASCI on a logarithmic axis, falling from 0.4 Ha at five configurations to 1 mHa at 75, below the dashed chemical-accuracy line at 1.6 mHa." caption="TE-QSCI error against CASCI for stretched N<sub>2</sub> as the subspace cap grows, every point selected from the same 8,000 samples. The dashed line is chemical accuracy." >}}

The whole example, with the two limit checks that reproduce Hartree-Fock
and CASCI exactly, is
[`mwe_qsci.ipynb`](https://github.com/OpenQARP/openqarp/blob/main/examples/algorithms/composite/mwe_qsci.ipynb).
Two helpers came with it: `qarp.operators.ComputationalBasisSector`
describes qubit partitions with fixed Hamming weights, and
`TrotterAnsatzBlock.generator_groups()` returns the commuting Pauli groups
of each generator before the block is built.

## GPU-accelerated quantum Monte Carlo

`MonteCarlo`, the quantum-classical Monte Carlo that the
[ethylene post](/posts/ethylene-with-a-twist/) used, moves a crowd of
walkers among electron configurations. Each walker that spawns onto a
neighbouring configuration needs the matrix element between the two, and
in the semiclassical mode that element comes from a short circuit run on
the engine. The crowd grows with the system, and so does the number of
circuits.

`qarp.algorithms.AggregatedMonteCarlo` reorganises the same evolution in
two ways. Walkers on the same configuration are one signed integer
population, so a configuration with eight hundred walkers costs the same
as one with eight. And the matrix elements are computed on the GPU as
exact FP64 transition columns, kept resident across time steps and across
trajectories, so no measurement circuit runs at all:
`diagnostics["measurement_circuits_executed"]` is zero by construction. The constructor has the same shape as `MonteCarlo`
plus the engine.

```python
from qarp.algorithms import AggregatedMonteCarlo, ResidentEvolutionConfig
from qarp.engines import CudaqEngine
from qarp.operators import ComputationalBasisSector

mc = AggregatedMonteCarlo(
    qubit_hamiltonian,
    approx_ground_state_energy=e_guess,
    total_time=2.0,
    time_step=0.05,
    reference_walker_label=reference_label,
    unitary_block=trial_block,
    engine=CudaqEngine(),
    initial_walker_count=1000,
    num_trajectories=10,
    resident_evolution=ResidentEvolutionConfig(
        ComputationalBasisSector(((0, 1, 2, 3),), (2,)),
    ),
    seed=7,
).build()
energy = mc.run()
```

`ResidentEvolutionConfig` restricts proposals to one particle-number
sector, described by a `ComputationalBasisSector`, and sets the batch size
and memory cap of the resident columns. `run()` pools the signed
contributions of every trajectory, and `diagnostics["estimator"]` carries
the leave-one-trajectory error bar.

This one is opt in. It needs a `CudaqEngine` in its default statevector
FP64 configuration and a build with `QARP_WITH_CUDAQ_SEMICLASSICAL=ON`,
which is off in the wheels: the build links cuStateVec's batched matrix
application, so it wants a CUDA compiler and the cuQuantum development
headers. `qx.montecarlo_available()` reports whether your build has it,
and `MonteCarlo` is unchanged. The
[installation page](https://docs.openqarp.com/source/installation.html#native-aggregated-monte-carlo-optional)
has the build line and
[`mwe_montecarlo_gpu.ipynb`](https://github.com/OpenQARP/openqarp/blob/main/examples/algorithms/composite/mwe_montecarlo_gpu.ipynb)
checks the GPU result against a two-qubit case worked out by hand.

## Faster simulation with structured execution

A statevector simulator pays one pass over all 2<sup>n</sup> amplitudes per
gate. Gate fusion merges neighbouring gates into fewer passes, and it
stops there: a thousand gates that only permute basis states still cost
hundreds of passes, and a phase-estimation ladder that applies the same
controlled unitary two thousand times is simulated two thousand times.

In 0.2.0, `Block.statevector` and the sampling paths of `QarpEngine` read
the block tree before simulating and run each piece as the cheapest exact
kernel: a basis-state permutation as one gather, a small block as one dense
matrix, a ladder of the same controlled block as one controlled-powers
kernel, and everything else as its fused gates. The result is exact, global
phase included. A circuit with no such structure runs as before.

Here is an increment, `x` to `x + 1 mod 256`, written as a ladder of
multi-controlled flips and applied eight times to two interleaved registers
of a 16-qubit state.

```python
import numpy as np
from qarp.blocks import CompositeBlock, SimpleBlock


class Increment(SimpleBlock):
    def build_vanilla(self):
        for t in reversed(range(1, self.n_qubits)):
            self.mcx(*range(t), t)
        self.x(0)


n = 16
step = CompositeBlock(
    [Increment(8, target_qubits=list(range(0, n, 2))),
     Increment(8, target_qubits=list(range(1, n, 2)))],
    n_qubits=n,
)
block = (step ** 8).build()
print(len(block.flatten()), "gates, runs as", block.kernels())
```

```
352 gates, runs as ['permutation']
```

Nothing was declared: the planner found the permutation in the gates. A
block can also declare what it does. `classical_action` states its
permutation, as `ModularMultiplicationBlock` does, and `structure()` states
its composition, as `QPEBlock` and `DOSQPEBlock` do. For phase estimation
the declaration means the controlled-U ladder is never built: the engine
reads the structure first, runs the ladder as one controlled-powers kernel
whatever the ancilla count, and the block stays unbuilt.

```python
import qarp
from qarp.algorithms import QPE
from qarp.blocks import ComputationalBasisStateBlock, SimpleBlock
from qarp.engines import QarpEngine

u = SimpleBlock(1)
u.p(0, 2 * np.pi * 0.375)
u.build()

qpe = QPE(
    state=ComputationalBasisStateBlock([1]),
    unitary=u,
    n_ancilla=11,
    engine=QarpEngine(n_shots=qarp.EXACT),
).build()
print(qpe.run(), qpe.block.is_built)
```

```
0.375 False
```

The phase 3/8 reads out exactly. On the same laptop:

| | 0.1.1 | 0.2.0 |
|---|---|---|
| Increment ×8 on 16 qubits, 352 gates, one `statevector` | 10.6 ms | 0.14 ms |
| QPE with 11 ancillas, build and run | 8.3 ms | 0.9 ms |
| QPE with 14 ancillas, build and run | 71 ms | 6.9 ms |

Structured execution is on by default. `structured=False` on
`Block.statevector` or on `QarpEngine` runs the gate stream as it is, and
`QARP_STRUCTURED=0` does the same for a whole process. Engines with a
device, amplitude-consuming primitives and the circuits a parameter-shift
gradient rewrites always take the gate path. `block.kernels()` lists the
kernels of a built block and `engine.kernels(primitive)` those of each
circuit of a built primitive, with `['gates']` for a circuit that runs as
gates. Both take `optimization_level`, new on `Block.statevector` and
`QarpEngine` too: the transpiler level applied to the gate slices after
planning. The
[structured execution example](https://github.com/OpenQARP/openqarp/blob/main/examples/engines/mwe_structured_execution.ipynb)
walks through all of this, and the
[configuration page](https://docs.openqarp.com/source/configuration.html#structured-execution)
has the contract.

## Simpler sampling analysis

`Sampler` and `PostSelection.apply` return a `SamplingDistribution`. It
reads and prints like the dict of 0.1, and it carries the shot count and
the analysis you would otherwise write by hand.

```python
from qarp.algorithms import Sampler
from qarp.blocks import SimpleBlock
from qarp.engines import QarpEngine

bell = SimpleBlock(2)
bell.h(0)
bell.cx(0, 1)
bell.measure([(q, q) for q in range(2)])
bell.build()

sampler = Sampler(ket=bell, n_shots=4000)
engine = QarpEngine(seed=42)
engine.build([sampler])
d = engine.run()[0]
print(d)
print(d.counts(), d.most_likely())
```

```
SamplingDistribution({(0, 0): 0.48875, (1, 1): 0.51125})
[1955 2045] ((1, 1), 0.51125)
```

`outcomes` and `probabilities` are aligned arrays. `standard_errors` gives
the binomial error per outcome, `marginal` traces out positions,
`parity_expectation` reads a Pauli-Z string off the samples, `top` and
`most_likely` pick the leading outcomes, `total_variation` and
`hellinger_fidelity` compare two distributions, and `sample` draws a
smaller set from a larger one. Keys and probabilities are the same as in
0.1. The type is new: `isinstance(result, dict)` is false and the object is
read-only. `to_dict()` returns a plain dict.

## Improved developer tools

### A typed backend

The compiled core, `qarpx`, ships with a stub package. An editor shows the
signatures behind `import qarpx as qx`, and mypy and pyright check calls
into it. The raw block methods take keyword arguments with the names the
Python blocks use, `q`, `angle` and so on. `qarp.blocks.QarpBlock` is the
union of the Python block classes, for annotating code that reads members
such as `symbols` or `parameter_map`, and it works with `isinstance`.

Projects that run mypy will see the stub picked up. An
`ignore_missing_imports` for `qarpx` no longer applies, and a call the stub
rejects, such as a NumPy integer as a qubit index, is reported. The
changelog gives the two settings that opt out.

### Changes to the source layout

In a checkout the Python package lives at `src/qarp/` and the C++ project
at `src/qarpx/`. Import names, module paths and the wheel are the same.
After pulling, re-run the editable install and delete the old `cpp/` and
`qarp/` trees, which are ignored and so invisible to `git status`. The
`qarpx` ABI is 17, and `import qarp` refuses an old build until the install
is redone.

## Upgrading to OpenQARP 0.2.0

Code that runs on 0.2.0 runs on every 0.2.x, so `openqarp~=0.2.0` is a safe
pin. These are the changes most likely to touch existing code.

### API and compatibility changes

- `Sampler` and `PostSelection.apply` return a `SamplingDistribution`.
  Replace `isinstance(r, dict)` and in-place edits with `to_dict()`.
- `is_built` is a read-only property on raw `qx` blocks, as on the Python
  ones: `b.is_built()` becomes `b.is_built`.
- `block.symbols` is a tuple on every block that has a registry, and
  reading it before the block has one raises. A `symbols is None` probe for
  built-ness becomes `not block.is_built`.
- A gate method called on a block that holds other blocks, composite,
  controlled or conditional, raises `TypeError`. Add the gate to a block the
  container holds.
- `qx.Command` checks the qubit and parameter counts of a gate. An integer
  in the second position is a qubit, so `Command(Rz, 0, 1)` raises; pass
  the angle as a float or a `qx.Param`.
- `QPE` and `DOSQPE` on a `QarpEngine` without a device leave their ladder
  unbuilt, and so `qpe.block`. Hand a declaring block to a primitive
  unbuilt; a block built first runs its ladder as gates.

### Renamed and removed interfaces

- Renames: `lambda_factor()` on the block-encoding and LCU projector blocks
  is the `lambda_norm` attribute; `state_preparation` on
  `AmplitudeAmplificationBlock` and `AmplitudeEstimationBlock` is
  `state_preparation_block`; `OrbitalRotationBlock.u` is `rotation_matrix`;
  `HaarRandomBlock.depth()` returns the circuit depth, with the layer count
  on `n_layers`.
- Removed: `Engine.prepare_structured_qpe`, `StructuredQPEPlan` and the
  structured QPE simulator bindings. Structured execution covers their case
  for any block.

### Primitives and engines

- A primitive implements `circuits()`, the block trees it runs, in place of
  `build()`.
- `Engine.batch_run` reuses the circuits a prior `build()` compiled, so a
  parameter sweep after `build()` runs without recompiling. `rebuild=True`
  compiles every primitive afresh.

### Performance and resource management

- `StateVector` with a Z-only observable builds its 2<sup>n</sup> diagonal
  at the first evaluation and reuses it; the engine's `build()` no longer
  pays for it. On the laptop above, a 20-qubit state against 210 Z and ZZ
  terms took 764 ms to build and evaluate once on 0.1.1 and 32 ms on 0.2.0.
- The OpenBLAS thread count of NumPy and SciPy is lowered to OpenQARP's at
  the first simulation, so a linear-algebra call no longer leaves a worker
  spinning on every logical CPU against the next simulator call. On the
  machine where this was measured, a 16-qubit `statevector` right after a
  norm went from 108 ms to under 8 ms. `QARP_BLAS_THREADS` has three
  settings: `limit`, the default; `pool`, which also runs those jobs on a
  pool whose workers sleep as soon as a call ends; and `native`, which
  leaves OpenBLAS alone.

The changelog has the complete list, including twenty-one fixes, among
them `AdaptVQD` honouring its convergence threshold, one eigenstate block
serving two QPE blocks, and the default thread count under OpenMP binding
counting every place.

## Get started

```shell
pip install -U openqarp
```

The wheels are on [PyPI](https://pypi.org/project/openqarp/0.2.0/) for
Linux, macOS and Windows, the
[release](https://github.com/OpenQARP/openqarp/releases/tag/v0.2.0) is on
GitHub with its archived copy on
[Zenodo](https://doi.org/10.5281/zenodo.24207400), and the
[documentation](https://docs.openqarp.com/) follows the code.

OpenQARP continues to evolve with your help, and we hope you enjoy this
upgrade. Tell us what you build with it on
[GitHub Discussions](https://github.com/OpenQARP/openqarp/discussions), and
what breaks on the issue tracker. See you at 0.3.
