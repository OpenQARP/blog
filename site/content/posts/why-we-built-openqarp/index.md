---
title: "Why we built OpenQARP and where it goes next"
date: 2026-10-23
summary: "OpenQARP started as a solution to a practical problem in our own quantum research. Two years later, it has grown into an open-source framework with ambitions that extend well beyond Fujitsu."
authors: [serban-georgescu, josh-kirsopp]
thumb: dialogue
tags: [interview, architecture, open-source]
---
OpenQARP started as a solution to a practical problem in our own quantum research. Two years later, it has grown into an open-source framework with ambitions that extend well beyond Fujitsu.

In this article, we share the story behind OpenQARP, what it offers developers and researchers today, and where we hope to take it next. We explore the research opportunities it opens up, our ambitions for an open community, the thinking behind its architecture, and how it fits into Fujitsu's wider quantum strategy.

## The problem, and what makes OpenQARP different

{{< lead >}}But first, let's go back to the problem that inspired OpenQARP and what makes the framework different.{{< /lead >}}

**Where did the idea for OpenQARP come from, and why did you decide to develop it further?**

**Josh**: I was collaborating with colleagues on quantum chemistry applications, and we were all using different tools, despite every project starting in much the same way. We each had our own versions of the pipeline, with different conventions. Comparing methods meant spending time reconciling conventions across scripts. We developed a lightweight package to align those conventions, and that became the beginning of OpenQARP.

**Serban**: Two things convinced me it was worth investing in. First, it already worked. The team had built it for its own research, and partners were using a beta through joint research and the Quantum Simulator Challenge. Second, there was a strategic opportunity. While we designed OpenQARP to be hardware independent, it aligned with Fujitsu's quantum computing plans. The company was developing quantum hardware, simulators and a hybrid quantum computing platform, and needed an application layer that researchers outside Fujitsu could use.

**What problem is OpenQARP designed to solve?**

**Josh**: The connections between tools. The ecosystem has good tools for individual steps: circuit SDKs, compilers, simulators and operator libraries. But connecting them into groups takes time, because each package has its own qubit ordering, phase conventions and performance limits. Convention mistakes in quantum software rarely crash. Instead, they often produce plausible but incorrect results.

**Serban**: Fragmentation and disposable code are holding quantum application research back. Every group rebuilds the same steps: a molecule to a Hamiltonian, a Hamiltonian to a circuit, a circuit to a simulator. Each version has its own conventions. Results from two groups are hard to compare, and when a result disagrees with a paper it is not clear which side is wrong.

Most of the problems we saw were convention problems: qubit order, factors of two in angles, global phases. We wanted them fixed once, written down and tested, so that two components written a year apart compose correctly. In our experience, too much effort was going into connecting tools rather than addressing the research question. We wanted to provide a shared foundation that researchers could build on.

**What is missing from other quantum software frameworks that makes OpenQARP different?**

**Serban**: The missing piece was not a feature. The established frameworks are mature, and OpenQARP connects to them. What was missing was a framework designed around the application rather than the circuit: the molecule or the graph is the input, the algorithm is a reusable object rather than a notebook, and the simulator or device can be swapped without rewriting the physics.

**Josh**: OpenQARP replaces those connections with one compositional model and one conventions document. A block written by one person composes with a primitive written by another and runs on an engine written by a third. The conventions document fixes endianness, angle conventions and phase behaviour for the whole codebase, and the code is tested against it. It is what lets components written at different times compose correctly.

**Why should developers already using tools such as Qiskit or PennyLane consider OpenQARP?**

**Josh**: They can retain their circuits and their knowledge from their existing workflow. OpenQARP converts circuits to and from Qiskit, PennyLane, pytket, qulacs and OpenQASM, and writes QIR, so an existing circuit comes in as a block and goes back out when needed. What they gain is the application layer: more than thirty algorithms and primitives that run on a molecule or a graph, a compiled core for operator algebra, compilation and simulation, and a test suite that checks numbers against references. You're never locked in. The package exists as a complement to existing tools.

**What would you like OpenQARP to be known for that distinguishes it from other tools?**

**Serban**: I'd emphasise trust and speed. A number produced by OpenQARP has been checked against an independent reference. Every numerical feature in the library is tested that way, and a benchmark result is published only with its correctness check. The compiled core means the time goes into trying ideas rather than waiting for them. We want OpenQARP to help accelerate research without compromising confidence in the results.

## Applications and research

{{< lead >}}We want researchers and developers to put OpenQARP to work on their own problems, explore new applications and build a body of knowledge.{{< /lead >}}

**Who is OpenQARP designed for, and what can developers achieve with it today?**

**Josh**: A researcher who knows the physics, wants to try an idea, and needs to trust the number. That may be a PhD student implementing a method from a paper, a chemist who has never written a circuit, or a developer in a company finding out whether a quantum approach helps with their problem. The design priorities follow from the audience: the problem stays in the foreground, the engine stays out of the way, and results come back in a form that can be checked.

**Serban**: Developers can establish what a method costs at the problem size that matters. They can design and test algorithms in simulation with full access to the state, which hardware never gives.

They can build the classical parts that are needed whatever the hardware looks like: problem encodings, measurement schemes, error mitigation, post-processing. And they can build skills.

**How can developers get started with OpenQARP, and how can they contribute to its development?**

**Josh**: Start from the problem, not the circuit. A molecule from pyscf or a graph from networkx becomes a Hamiltonian. Pick an algorithm from the library, run it on the default engine with a seed, and compare the energy with exact diagonalisation. This shouldn't take someone long. Trying something new should also be a relatively barrierless experience. Define your own blocks, change the primitive to get gradients or a different observable. Add a device model and see what noise does, or move to a GPU. At each step one layer changes and the other two stay. The tutorials cover all this too so you don't have to figure this out from scratch.

**Serban**: In terms of contributions, algorithms first. An implementation of a method from a recent paper, with tests against the paper's numbers, is the contribution a PhD student is best placed to make and the one the library gains most from. Then the less visible work: a bug found by running a problem we never tried, a convention we got wrong, an integration with a tool we do not use. And use cases from other fields. Someone in biology or logistics who shows what the framework has to do for their problem changes the library more than an internal roadmap does.

**What research applications are you most excited about, and how can you identify the most promising opportunities?**

**Serban**: Chemistry and materials, because it is the clearest case for a quantum computer and the area where our team has the most experience. I want to see molecular work move past textbook systems to sizes where classical methods struggle, with resource estimates attached. Then optimisation, where the open question is whether any quantum approach beats a good classical heuristic. The field needs careful experiments there. And fields we know less well. The first use cases in the repository are a DNA search, a molecular torsion scan, a portfolio problem and an image classifier.

**Josh**: By requiring a classical baseline and a resource estimate. An experiment is promising when the problem is one that someone has, the best classical method is stated and run on the same instance, and the quantum resource count at the real problem size is written down. OpenQARP makes the three easy to do in one place. The problem comes in from pyscf or networkx, the baseline can be computed alongside, and the compiled circuit gives the counts.

**How can PhD researchers contribute new algorithms and build on each other's work?**

**Josh**: Implement the algorithm as blocks and primitives, write the tests against the numbers in the paper, and open a pull request. The contributing guide describes the process: a short plan first, then the implementation, then a review. In return, the method becomes something other people run with one import. It is tested on every change to the library, so it keeps working after the author has moved on. And the author can write it up on the blog under their own name. We just help out with the plumbing.

## Open source and the community

{{< lead >}}Making OpenQARP open source was a deliberate decision and building a community is a key part of the vision.{{< /lead >}}

**Why is building an open-source community so important to OpenQARP's future?**

**Serban**: A framework used only inside Fujitsu would not serve its purpose. The value of shared components grows with the number of people sharing them: more review of the conventions, more independent checks on the results, more algorithms contributed. Openness is also how research software earns trust. Anyone can read the tests, rerun the benchmarks and see what a number means. We chose Apache 2.0 because it is permissive, it is the licence the ecosystem already uses, and it includes a patent grant, which matters to a company deciding whether to build on it.

**Josh**: We cannot try every molecule, every graph, every combination of blocks. More users can help us explore, and new users with different ideas shake out the bugs more effectively than anyone else. Moreover, we hope that people working in fields we do not know will tell us what the library needs.

**Serban**: We'd like to see a community of researchers who use it and researchers who extend it, with no sharp line between the two. PhD students contributing their algorithm with its tests. Industry groups trying their problem and reporting where it breaks. People from adjacent fields who know the application but not the physics. Collaboration happens in the open, through the repository, so a discussion about a convention or a method is visible to everyone who comes after. The output is implementations that stay runnable, comparisons on the same basis, and papers that can be rerun.

**Who would you most like to see getting involved, and what would you say to developers considering taking their first steps?**

**Josh**: Researchers and developers outside Fujitsu who have real problems they want to solve. Define a problem, run some of the algorithms and tell us where it broke or where it was slower than expected. That kind of unbiased feedback that only an interested community can give you is more valuable than any feature request. The second group is PhD students with a method from their paper that is not in the library yet. Those are the contributions we want the most.

**Serban**: It is early, and that is the reason to start. The field needs people who write good software as much as it needs physicists. You do not need the physics to begin: install the package, run the tutorials, change one thing and see what happens. The people who build the tooling now will know what it needs when the hardware is ready.

## Architecture and strategy

{{< lead >}}Making all this possible has involved some key decisions, both in how we've designed OpenQARP and how it fits into Fujitsu's wider quantum research.{{< /lead >}}

**Why did you organise the framework around blocks, primitives and engines?**

**Josh**: At first we didn't. We iteratively arrived at this structure over the course of many refactors until the blocks fell out and we had a clean separation between building circuits and executing them. We arrived at this structure because researchers had some really good ideas and, since we were building for ourselves at that time, we were able to adapt the code quickly.

**Why did you build a Python interface with a C++ core?**

**Josh**: Python is where researchers work. The C++ core exists because the Python around the simulator had become the bottleneck. The state-vector kernels were fast. The operator algebra, the circuit construction, the compilation and the overhead between calls were not. For a long time OpenQARP was pure Python with a third-party circuit library, and a dependency update could force a hotfix release. Owning the core gives us control of conventions, performance and release timing. The binding layer is thin, and from Python the seam is not visible.

**How does it connect to Fujitsu's wider quantum strategy?**

**Serban**: Fujitsu works across the whole stack: superconducting hardware with RIKEN, diamond-spin qubits with TU Delft, error correction with Osaka University, large-scale simulators on its own HPC systems, a hybrid quantum computing platform, and applications developed with customers in materials, drug discovery and finance. OpenQARP is the application-research layer of that stack. It runs on Fujitsu's simulators, it exports to standard formats that reach hardware, and it is where the algorithms we and our partners work on are implemented.

**What is the benefit to the OpenQARP developer community of Fujitsu's presence behind it?**

**Serban**: Continuity and a route to hardware. Research software often stops being maintained when its author moves on. OpenQARP has a team whose job includes maintaining it, a release process, wheels for Linux, macOS and Windows, and a company that builds the machines it is meant to run on.

For a developer this means bugs get fixed, changes are documented in release notes, and there is a path from simulation to a device. It also means access: outside groups have already used OpenQARP on Fujitsu's simulators through joint research and the Quantum Simulator Challenge.

## The future

{{< lead >}}Finally, let's look at the future.{{< /lead >}}

**How does OpenQARP need to evolve as quantum hardware advances?**

**Josh**: The most important next step is to establish a clear path to quantum hardware. The framework is simulation-first by design, and the export paths exist. The step from a simulated run to a run on a device, with the compilation, the noise and the results coming back into the same objects, is the one I most want to complete. It is the priority because it tests whether the three layers hold when the engine is a machine rather than a program.

As hardware advances, some aspects of OpenQARP will evolve, but the blocks, primitives and conventions will stay. A Trotter step or a phase-estimation circuit is the same mathematics on a simulator and on a fault-tolerant machine, and the question asked of it is the same. The engines evolve: new device models, error correction underneath, hardware that does not exist yet. The algorithm library will shift from variational methods towards fault-tolerant ones as hardware allows. Resource estimation will matter more, because the question moves from whether a circuit runs to what it costs.

**Serban**: We need to support both near-term research and the development of applications for future quantum computers. The library contains VQE, QAOA and ADAPT for today's noisy devices, and phase estimation, qubitization, QSVT and Shor for machines that do not exist yet. The architecture makes this possible: the same blocks and primitives run with a different engine configuration. The two inform each other. Near-term work shows what devices do today. Fault-tolerant work shows what the long-term goal costs. Resource estimation sits between them, and I expect much of the useful work of the next few years there.

**What would success for OpenQARP look like over the next three to five years?**

**Josh**: A result that moves a field outside quantum computing. A chemist who learns something about a molecule they could not have learned otherwise, using the library as a tool rather than as the subject.

Short of that, an engine for hardware we have never touched, with every algorithm in the library running on it unchanged. That is what the architecture was designed for.

**Serban**: A result in a published paper reproduced by someone else by installing the package and running a notebook, as a routine thing. More concretely: papers from outside Fujitsu whose implementation lives in the library, PhD students starting a project from a working baseline rather than a blank file, and a workflow that goes from a molecule on a laptop to a device without rewriting. If the framework has become the thing people check their own code against, it has done its job.

**What would it mean to you to see other developers take it in directions you had never imagined?**

**Josh**: OpenQARP is nothing like what it started as. Over two years the team built on ideas from many people, and those ideas became the three layers we have today. The structure, the C++ core and the test discipline all came later, and none of them were in the original plan.

Watching a project change this much has been fun, and I am curious to see where it goes next. If other developers take it somewhere unexpected, that is the same process continuing outside the team and that's what OSS is all about.
