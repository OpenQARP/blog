---
title: "What is OpenQARP?"
date: 2026-10-23
summary: "An open-source software framework designed to make quantum application development faster, easier and more reliable. It provides you with the framework, algorithms and tools you need to explore, build and test quantum applications in an integrated, flexible and hardware-agnostic way."
authors: [saif-rayyan]
thumb: layers
tags: [news, getting-started, architecture, release]
---

OpenQARP (Open Quantum Application Research Package) is an open-source software framework designed to make quantum application development faster, easier and more reliable. It provides you with the framework, algorithms and tools you need to explore, build and test quantum applications in an integrated, flexible and hardware-agnostic way.

Quantum computing promises new approaches to solving some of the most difficult problems in science, engineering and business. But developing the applications to exploit this is a complex undertaking. If the very nature of this field is not challenging enough, researchers typically need to combine multiple tools, which requires knowledge of what type of hardware and architecture they are implementing on. Integrating these can be complicated, inefficient and lead to errors.

The central innovation of OpenQARP is a modular architecture that makes algorithms easier to develop, test and execute. It sits on a substantial library of existing algorithms and reusable components - including a wealth of research developed by Fujitsu and now made openly available - giving developers a head start. While integration with established quantum software allows them to build and connect with tools they already know. Our benchmarking tests show it is high performing and reliable, allowing developers to feel confident in their results.

{{< figure src="architecture.png" alt="Diagram of OpenQARP's three components: blocks, primitives and engines." caption="OpenQARP's modular architecture separates quantum computation into three complementary components: blocks, primitives and engines. This separation makes applications easier to construct, modify and extend, designed to provide flexibility for developers." >}}

Our ambition goes beyond providing the industry with another software toolkit. This is about building a community that can further the enrichment of quantum research. Released under an open-source licence, OpenQARP is designed to be a shared resource for all of us in the quantum research and application development community. A platform that researchers can use, improve and extend, accelerating progress for everyone.

You can read more about why we built OpenQARP [here](/posts/why-we-built-openqarp/).

## What can OpenQARP do for you?

Let's look in more detail of how OpenQARP can help you.

### Build on an extensive library of existing research

OpenQARP provides a rich library of algorithms and tools for applications, going far beyond what's available in other toolsets. It includes implementations of algorithms described in published research, from chemistry to mathematical computation, and more than 70 classes of reusable circuit blocks.

Developers can study these implementations, execute them, modify their parameters and adapt them to investigate new problems. This helps bridge the gap between theoretical research and practical experimentation. Instead of spending time reproducing an algorithm from a research paper, developers can begin with an existing implementation and concentrate on exploring what it can do. It frees you to concentrate on your area of interest, rather than spending time developing and managing the supporting components.

### Start small, build incrementally and reuse components

We designed OpenQARP around modular components that can be combined, modified and reused. For example, a developer might begin with a simple experiment involving two entangled qubits, then progressively construct more sophisticated circuits and algorithms. Rather than rewriting an application whenever requirements change, developers can reuse existing components or substitute alternative implementations.

This modular approach makes it easier to experiment, compare different methods and develop increasingly sophisticated applications. It also supports collaboration: components developed for one research project can potentially be reused in another.

### Work with the quantum tools you already use

The framework supports interoperability with tools and formats including Qiskit, PennyLane, pytket, Qulacs, OpenQASM, QIR, as well as chemistry software such as PySCF and OpenFermion. It also has an engine for NVIDIA's CUDA-Q, which runs circuits on GPU simulators from a build with CUDA-Q support. These connections allow researchers to combine OpenQARP's algorithms and reusable components with established development environments.

For example, a researcher might use chemistry software to describe a molecule, OpenQARP to investigate an algorithm and another tool to analyse or execute the resulting circuit. The benefit is flexibility. Researchers can build on their existing investments in software, knowledge and code rather than adopting an entirely new technology stack.

### Designed for high performance

Performance benchmarks reported in our [research paper](https://arxiv.org/pdf/2609.15697) demonstrate substantial improvements across several workloads compared with established quantum frameworks. In selected operator algebra benchmarks, OpenQARP achieved improvements of one to two orders of magnitude. In a single-threaded 20-qubit circuit simulation benchmark, it completed the calculation in approximately 40 milliseconds, compared with 125 milliseconds using Qiskit/Aer. While these results come from specific workloads and testing environments, they show how OpenQARP's architecture can reduce computational overhead and accelerate experimentation.

### Delivering results with confidence

Quantum software presents particular challenges because subtle differences in mathematical conventions, qubit ordering or quantum phases can produce results that appear plausible but are incorrect. OpenQARP's development process includes about 3,000 Python test functions, more than 800 C++ tests, and independent reference values for every numerical result: analytic values, published numbers such as full configuration interaction energies for small molecules, and reference implementations. This emphasis on correctness helps researchers distinguish genuine scientific findings from software implementation errors.

### Accessible, open-source and ready for AI-assisted development

OpenQARP is freely available under the Apache 2.0 licence, allowing researchers and developers to use, modify and contribute to the software. Its Python interface makes it accessible to developers familiar with mainstream scientific computing, while the underlying C++ implementation provides high-performance execution.

OpenQARP's development has also incorporated AI coding agents, including Claude Code, alongside structured development plans, human review and automated testing.

This creates opportunities for AI-assisted experimentation and development, while maintaining the rigorous validation required for scientific software.

## What problems can OpenQARP help to solve?

OpenQARP supports research across several important classes of quantum computing problems, spanning approaches that can be investigated today and algorithms intended for future fault-tolerant quantum computers.

### Quantum chemistry and materials science

Quantum chemistry is a particular area of strength for OpenQARP, combining algorithm implementations, mathematical tools and simulation capabilities within a single framework.

How can we calculate the energy of a molecule? How might its electronic structure change when its atoms move? Understanding molecular behaviour is computationally demanding because the interactions between electrons are governed by quantum mechanics.

OpenQARP provides algorithms including Variational Quantum Eigensolver (VQE) and Quantum Phase Estimation (QPE), alongside specialised tools for constructing and investigating quantum chemistry applications. Its integration with PySCF and OpenFermion allows researchers to connect established molecular modelling workflows with quantum algorithms.

An illustration of these capabilities is an application investigating ethylene, a molecule containing a carbon to carbon double bond. As the molecule twists, its electronic structure changes, creating a challenging computational problem. Read the use case [here](https://github.com/OpenQARP/openqarp/blob/develop/examples/use_cases/chemistry_ethylene_torsion.ipynb).

### Optimisation problems

What's the most efficient delivery route? How should limited resources be allocated? Optimisation problems appear throughout logistics, finance, manufacturing and engineering.

OpenQARP includes implementations of algorithms such as the Quantum Approximate Optimisation Algorithm (QAOA), enabling researchers to investigate quantum approaches to these challenges. Its reusable components and simulation tools make it easier to construct experiments, compare algorithm configurations and evaluate performance. It also includes Pauli Correlation Encoding, with extensions developed at Fujitsu, which fits large optimisation problems onto a small number of qubits. You can see how it is used in the portfolio diversification use case [here](https://github.com/OpenQARP/openqarp/blob/develop/examples/use_cases/finance_portfolio_diversification.ipynb).

### Probability estimation and uncertainty

How might we estimate the probability of a financial loss? Or calculate the likelihood of a particular outcome in a complex system?

OpenQARP includes algorithms such as quantum amplitude estimation, which investigates quantum approaches to estimating probabilities and expected values. These methods are relevant to research in financial modelling, risk analysis and scientific simulation. Researchers can explore different algorithm implementations, measurement techniques and computational requirements within a common environment.

### Search, mathematical computation and quantum simulation

OpenQARP also supports algorithms including Grover's search and Shor's factoring algorithm, alongside techniques for investigating the behaviour of quantum physical systems. Its library includes methods such as quantum Monte Carlo and quantum imaginary-time evolution.

The breadth of these capabilities allows researchers to explore different classes of problems without assembling a separate development environment for each one. Across these applications, OpenQARP gives you tools for constructing circuits, measuring results, validating calculations and comparing approaches.

## How you can get involved

This is only the beginning. We released OpenQARP as version 0.1.0 in September 2026. It already provides a substantial foundation for quantum application research but is not a finished product. New algorithms, capabilities and integrations will continue to emerge as the platform develops.

You can get started right away, [this post](/posts/getting-started-with-openqarp/) will show you how.

We want OpenQARP to help accelerate and enrich your research, and at the same time we want your research to help make OpenQARP even better. Whatever your project, we invite you to get involved. Explore the framework, experiment with its algorithms, build new applications and share what you discover. Your feedback, ideas and contributions can help shape its future development. This blog will be a window into that evolving community.

We'll share practical tutorials, technical insights, research applications, performance investigations and updates on new capabilities. We'll also showcase the work of researchers and developers using OpenQARP to explore new ideas. Our goal is to create a place where knowledge, experience and discoveries can be shared, helping everyone make faster progress.

Quantum computing still has significant challenges to overcome. But there's no reason to wait for tomorrow's quantum computers before developing tomorrow's quantum applications. OpenQARP provides the tools to start exploring today. We look forward to discovering what we can build together.

Explore OpenQARP on [GitHub](https://github.com/OpenQARP/openqarp), read the [documentation](https://docs.openqarp.com/), and join the community on [GitHub Discussions](https://github.com/OpenQARP/openqarp/discussions)!
