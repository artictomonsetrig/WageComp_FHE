pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract WageComp_FHE is ZamaEthereumConfig {
    struct EncryptedSalary {
        euint32 encryptedAmount;      // Encrypted salary value
        uint256 industryCode;         // Public industry identifier
        uint256 experienceYears;      // Public years of experience
        address employeeAddress;      // Employee wallet address
        uint256 submissionTimestamp;  // Block timestamp of submission
        bool isVerified;              // Verification status flag
    }

    struct SalaryBenchmark {
        uint256 industryCode;         // Industry identifier
        uint256 percentileRank;       // Percentile rank (1-100)
        uint256 count;                // Number of salaries in benchmark
        uint256 lastUpdated;          // Timestamp of last update
    }

    mapping(uint256 => SalaryBenchmark) public industryBenchmarks;
    mapping(address => EncryptedSalary) public employeeSalaries;
    mapping(uint256 => address[]) public industryParticipants;

    event SalarySubmitted(address indexed employee, uint256 industryCode);
    event BenchmarkUpdated(uint256 industryCode, uint256 percentileRank);
    event SalaryVerified(address indexed employee);

    modifier onlyValidIndustry(uint256 industryCode) {
        require(industryCode > 0, "Invalid industry code");
        _;
    }

    constructor() ZamaEthereumConfig() {
        // Initialize with default benchmarks
        industryBenchmarks[101] = SalaryBenchmark(101, 50, 0, block.timestamp);
        industryBenchmarks[202] = SalaryBenchmark(202, 50, 0, block.timestamp);
        industryBenchmarks[303] = SalaryBenchmark(303, 50, 0, block.timestamp);
    }

    function submitEncryptedSalary(
        externalEuint32 encryptedAmount,
        bytes calldata encryptionProof,
        uint256 industryCode,
        uint256 experienceYears
    ) external onlyValidIndustry(industryCode) {
        require(
            FHE.isInitialized(FHE.fromExternal(encryptedAmount, encryptionProof)),
            "Invalid encrypted input"
        );

        require(
            employeeSalaries[msg.sender].submissionTimestamp == 0,
            "Salary already submitted"
        );

        euint32 encryptedValue = FHE.fromExternal(encryptedAmount, encryptionProof);

        employeeSalaries[msg.sender] = EncryptedSalary({
            encryptedAmount: encryptedValue,
            industryCode: industryCode,
            experienceYears: experienceYears,
            employeeAddress: msg.sender,
            submissionTimestamp: block.timestamp,
            isVerified: false
        });

        FHE.allowThis(encryptedValue);
        FHE.makePubliclyDecryptable(encryptedValue);

        industryParticipants[industryCode].push(msg.sender);
        updateBenchmark(industryCode);

        emit SalarySubmitted(msg.sender, industryCode);
    }

    function verifySalary(
        address employeeAddress,
        bytes memory abiEncodedClearValue,
        bytes memory decryptionProof
    ) external {
        require(
            employeeSalaries[employeeAddress].submissionTimestamp > 0,
            "Salary not submitted"
        );
        require(
            !employeeSalaries[employeeAddress].isVerified,
            "Salary already verified"
        );

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(employeeSalaries[employeeAddress].encryptedAmount);

        FHE.checkSignatures(cts, abiEncodedClearValue, decryptionProof);

        employeeSalaries[employeeAddress].isVerified = true;
        emit SalaryVerified(employeeAddress);
    }

    function getSalaryBenchmark(uint256 industryCode)
        external
        view
        onlyValidIndustry(industryCode)
        returns (SalaryBenchmark memory)
    {
        return industryBenchmarks[industryCode];
    }

    function getEmployeeSalary(address employeeAddress)
        external
        view
        returns (EncryptedSalary memory)
    {
        require(
            employeeSalaries[employeeAddress].submissionTimestamp > 0,
            "Salary not submitted"
        );
        return employeeSalaries[employeeAddress];
    }

    function getIndustryParticipants(uint256 industryCode)
        external
        view
        onlyValidIndustry(industryCode)
        returns (address[] memory)
    {
        return industryParticipants[industryCode];
    }

    function updateBenchmark(uint256 industryCode) private {
        uint256 participantCount = industryParticipants[industryCode].length;
        if (participantCount > 0) {
            // Simplified benchmark update logic
            // In real implementation, this would use FHE computations
            uint256 newRank = (industryBenchmarks[industryCode].percentileRank *
                industryBenchmarks[industryCode].count +
                participantCount * 10) / (industryBenchmarks[industryCode].count +
                participantCount);

            industryBenchmarks[industryCode] = SalaryBenchmark({
                industryCode: industryCode,
                percentileRank: newRank,
                count: participantCount,
                lastUpdated: block.timestamp
            });

            emit BenchmarkUpdated(industryCode, newRank);
        }
    }

    function isAvailable() public pure returns (bool) {
        return true;
    }
}


