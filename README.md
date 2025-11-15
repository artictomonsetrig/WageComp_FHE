# Private Salary Benchmark

The Private Salary Benchmark is a privacy-preserving application that leverages Zama's Fully Homomorphic Encryption (FHE) technology to enable secure salary data analysis without exposing sensitive information. This innovative solution enables HR departments to input encrypted salary data and perform homomorphic queries to determine industry percentiles without disclosing specific figures, thus promoting workplace transparency while maintaining data security.

## The Problem

In today's data-driven world, privacy concerns regarding salary information are mounting. Traditional methods of salary benchmarking often require organizations to share sensitive data, which can lead to potential leaks and breaches of privacy. Cleartext salary data is dangerous as it can expose employees to discrimination, bias, and possible financial repercussions. This highlights the urgent need for secure methodologies that allow companies to benchmark salaries without compromising individual privacy.

## The Zama FHE Solution

Fully Homomorphic Encryption (FHE) offers a powerful solution by allowing computation on encrypted data while keeping it confidential. In this application, Zama's libraries are employed to enable encryption and processing of salary data. Utilizing fhevm to process encrypted inputs facilitates secure calculations, ensuring that sensitive information remains confidential throughout the benchmarking process. With Zama’s technology, organizations can now harness the power of data analytics without exposing sensitive salary details.

## Key Features

- 🔒 **Privacy Protection**: Keeps salary data confidential while allowing for robust analysis.
- 📊 **Industry Percentile Queries**: Conduct queries to find salary percentiles across various industries without revealing individual salaries.
- 🤝 **Workplace Transparency**: Supports fair salary benchmarks while maintaining individual privacy.
- ⚙️ **Secure Data Handling**: Relies on strong cryptographic principles to safeguard sensitive information.
- 📈 **Computation on Encrypted Data**: Performs complex calculations directly on encrypted data, ensuring data security at all levels.

## Technical Architecture & Stack

The Private Salary Benchmark is built using a solid technical stack, fundamentally powered by Zama's privacy technology:

- **Core Technology**: Zama's FHE, specifically leveraging the following libraries:
  - **fhevm**: To perform operations on encrypted salary data.
  - **Concrete ML**: For any machine learning components that may be integrated in the future.
  - **TFHE-rs**: To facilitate low-level cryptographic functions.
- **Frontend/Backend Frameworks**: Depending on implementation, could include Node.js for the backend and React.js for the frontend.
- **Database**: Encrypted databases or secure storage solutions for managing encrypted salary data.

## Smart Contract / Core Logic Example

Here’s a pseudo-code example that illustrates how salary data could be handled using Zama’s technology:solidity
pragma solidity ^0.8.0;

import "fhevm.sol";

contract SalaryBenchmark {
    function queryPercentile(uint64 encryptedSalary) public view returns (uint64) {
        // Using tfhe.add to compute encrypted salary percentile
        uint64 percentile = TFHE.add(encryptedSalary, some_encrypted_salary_data);
        // Decrypt the result before sending it back
        return TFHE.decrypt(percentile);
    }
}

This example showcases how salary benchmarking could be implemented in a smart contract, illustrating the direct interface with Zama's FHE capabilities.

## Directory Structure

The project follows a well-organized directory structure to ensure maintainability:
/private-salary-benchmark
├── /contracts
│   └── SalaryBenchmark.sol
├── /src
│   ├── main.py
│   └── helpers.py
├── /tests
│   ├── test_salary_benchmark.py
└── README.md

## Installation & Setup

To get started with the Private Salary Benchmark, please follow the prerequisites and installation instructions below:

### Prerequisites

- **Python 3.x** or **Node.js** installed on your system.
- A package manager (like pip for Python or npm for Node.js).

### Installation Steps

1. **Install Dependencies**:
   - For Python:bash
     pip install concrete-ml
   - For Node.js:bash
     npm install fhevm

2. **Clone the Repository**:
   (Note: Do not include cloning commands or URLs here.)

## Build & Run

To build and run the application, execute the following commands:

- **For Node.js**:bash
  npx hardhat compile
  npx hardhat run scripts/deploy.js

- **For the Python application**:bash
  python main.py

These commands compile the contracts and run the application, allowing you to start interacting with the Private Salary Benchmark.

## Acknowledgements

We would like to extend our sincere gratitude to Zama for providing the open-source FHE primitives that make this project possible. Their commitment to enabling privacy-preserving technologies is instrumental in creating secure applications that protect sensitive data while allowing for intelligent analysis.

---

The Private Salary Benchmark represents a significant step forward in ensuring salary data privacy in HR practices. By embracing Zama's FHE technology, organizations can confidently leverage sensitive information to foster transparency and fairness in the workplace.


