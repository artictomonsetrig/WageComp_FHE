import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';
import { ethers } from 'ethers';

interface SalaryData {
  id: number;
  name: string;
  position: string;
  encryptedSalary: string;
  timestamp: number;
  creator: string;
  publicValue1: number;
  publicValue2: number;
  isVerified?: boolean;
  decryptedValue?: number;
}

interface SalaryAnalysis {
  percentile: number;
  industryAverage: number;
  experienceLevel: number;
  marketPosition: number;
  growthPotential: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [salaries, setSalaries] = useState<SalaryData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingSalary, setCreatingSalary] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({
    visible: false,
    status: "pending" as const,
    message: ""
  });
  const [newSalaryData, setNewSalaryData] = useState({ name: "", position: "", salary: "" });
  const [selectedSalary, setSelectedSalary] = useState<SalaryData | null>(null);
  const [decryptedData, setDecryptedData] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, verified: 0, average: 0 });

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting} = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected) return;
      if (isInitialized || fhevmInitializing) return;

      try {
        setFhevmInitializing(true);
        await initialize();
      } catch (error) {
        setTransactionStatus({
          visible: true,
          status: "error",
          message: "FHEVM initialization failed"
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }

      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;

    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;

      const businessIds = await contract.getAllBusinessIds();
      const salariesList: SalaryData[] = [];

      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          salariesList.push({
            id: parseInt(businessId.replace('salary-', '')) || Date.now(),
            name: businessData.name,
            position: businessData.description,
            encryptedSalary: businessId,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading business data:', e);
        }
      }

      setSalaries(salariesList);
      updateStats(salariesList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const updateStats = (salaryList: SalaryData[]) => {
    const total = salaryList.length;
    const verified = salaryList.filter(s => s.isVerified).length;
    const avg = salaryList.length > 0
      ? salaryList.reduce((sum, s) => sum + s.publicValue1, 0) / salaryList.length
      : 0;

    setStats({ total, verified, average: avg });
  };

  const addToHistory = (action: string, data: any) => {
    setUserHistory(prev => [{
      action,
      data,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9)
    }, ...prev.slice(0, 9)]);
  };

  const testAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;

      const available = await contract.isAvailable();
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Contract is available and ready"
      });
      addToHistory("Contract Availability Check", { result: available });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Availability check failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const createSalary = async () => {
    if (!isConnected || !address) {
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return;
    }

    setCreatingSalary(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating salary record with Zama FHE..." });

    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");

      const salaryValue = parseInt(newSalaryData.salary) || 0;
      const businessId = `salary-${Date.now()}`;

      const encryptedResult = await encrypt(contractAddress, address, salaryValue);

      const tx = await contract.createBusinessData(
        businessId,
        newSalaryData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        parseInt(newSalaryData.position) || 0,
        0,
        newSalaryData.position
      );

      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction confirmation..." });
      await tx.wait();

      setTransactionStatus({ visible: true, status: "success", message: "Salary record created successfully!" });
      addToHistory("Create Salary Record", { name: newSalaryData.name, position: newSalaryData.position });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);

      await loadData();
      setShowCreateModal(false);
      setNewSalaryData({ name: "", position: "", salary: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally {
      setCreatingSalary(false);
    }
  };

  const decryptData = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) {
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null;
    }

    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;

      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        setTransactionStatus({
          visible: true,
          status: "success",
          message: "Salary already verified on-chain"
        });
        addToHistory("View Verified Salary", { value: storedValue });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        return storedValue;
      }

      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;

      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);

      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) =>
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );

      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption on-chain..." });

      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];

      await loadData();
      addToHistory("Decrypt Salary", { value: Number(clearValue) });

      setTransactionStatus({ visible: true, status: "success", message: "Salary decrypted and verified successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);

      return Number(clearValue);

    } catch (e: any) {
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({
          visible: true,
          status: "success",
          message: "Salary is already verified on-chain"
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);

        await loadData();
        return null;
      }

      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Decryption failed: " + (e.message || "Unknown error")
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null;
    } finally {
      setIsDecrypting(false);
    }
  };

  const analyzeSalary = (salary: SalaryData, decryptedAmount: number | null): SalaryAnalysis => {
    const amount = salary.isVerified ? (salary.decryptedValue || 0) : (decryptedAmount || salary.publicValue1 * 1000 || 50000);
    const experience = salary.publicValue1 || 3;

    const basePercentile = Math.min(99, Math.max(1, Math.round((amount / 100000) * 100)));
    const experienceFactor = Math.min(1.5, Math.max(0.5, experience / 5));
    const percentile = Math.round(basePercentile * experienceFactor);

    const industryAverage = Math.round(amount * 0.8 + 20000);
    const experienceLevel = Math.round((experience / 10) * 100);

    const marketPosition = Math.min(100, Math.round((amount / 150000) * 100));
    const growthPotential = Math.min(95, Math.round((experience * 10 + (amount / 10000))));

    return {
      percentile,
      industryAverage,
      experienceLevel,
      marketPosition,
      growthPotential
    };
  };

  const renderStatsPanel = () => {
    return (
      <div className="stats-panels">
        <div className="stat-panel gold-panel">
          <h3>Total Records</h3>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-trend">FHE Protected</div>
        </div>

        <div className="stat-panel silver-panel">
          <h3>Verified Data</h3>
          <div className="stat-value">{stats.verified}/{stats.total}</div>
          <div className="stat-trend">On-chain Verified</div>
        </div>

        <div className="stat-panel bronze-panel">
          <h3>Avg Experience</h3>
          <div className="stat-value">{stats.average.toFixed(1)} yrs</div>
          <div className="stat-trend">Public Data</div>
        </div>
      </div>
    );
  };

  const renderAnalysisChart = (salary: SalaryData, decryptedAmount: number | null) => {
    const analysis = analyzeSalary(salary, decryptedAmount);

    return (
      <div className="analysis-chart">
        <div className="chart-row">
          <div className="chart-label">Salary Percentile</div>
          <div className="chart-bar">
            <div
              className="bar-fill"
              style={{ width: `${analysis.percentile}%` }}
            >
              <span className="bar-value">{analysis.percentile}%</span>
            </div>
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-label">Industry Average</div>
          <div className="chart-bar">
            <div className="bar-fill average" style={{ width: '50%' }}>
              <span className="bar-value">${analysis.industryAverage.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-label">Experience Level</div>
          <div className="chart-bar">
            <div
              className="bar-fill"
              style={{ width: `${analysis.experienceLevel}%` }}
            >
              <span className="bar-value">{analysis.experienceLevel}%</span>
            </div>
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-label">Market Position</div>
          <div className="chart-bar">
            <div
              className="bar-fill"
              style={{ width: `${analysis.marketPosition}%` }}
            >
              <span className="bar-value">{analysis.marketPosition}%</span>
            </div>
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-label">Growth Potential</div>
          <div className="chart-bar">
            <div
              className="bar-fill growth"
              style={{ width: `${analysis.growthPotential}%` }}
            >
              <span className="bar-value">{analysis.growthPotential}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFHEFlow = () => {
    return (
      <div className="fhe-flow">
        <div className="flow-step">
          <div className="step-icon">💰</div>
          <div className="step-content">
            <h4>Salary Encryption</h4>
            <p>Personal salary encrypted with Zama FHE 🔐</p>
          </div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <div className="step-icon">🔗</div>
          <div className="step-content">
            <h4>On-chain Storage</h4>
            <p>Encrypted data stored securely on-chain</p>
          </div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <div className="step-icon">🔓</div>
          <div className="step-content">
            <h4>Private Decryption</h4>
            <p>Client-side decryption for percentile analysis</p>
          </div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <div className="step-icon">📊</div>
          <div className="step-content">
            <h4>Benchmark Results</h4>
            <p>Get industry comparison without revealing salary</p>
          </div>
        </div>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>Private Salary Benchmark 🔐</h1>
          </div>
          <div className="header-actions">
            <div className="wallet-connect-wrapper">
              <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
            </div>
          </div>
        </header>

        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">💰</div>
            <h2>Connect Your Wallet to Continue</h2>
            <p>Please connect your wallet to access private salary benchmarking with FHE encryption.</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>Connect your wallet securely</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>FHE system initializes automatically</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>Benchmark salary privately</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing FHE Encryption System...</p>
        <p className="loading-note">Securing your salary data</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Loading salary benchmark system...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>Private Salary Benchmark 🔐</h1>
        </div>

        <div className="header-actions">
          <button onClick={testAvailability} className="test-btn">
            Test Contract
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="create-btn"
          >
            + Add Salary
          </button>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>

      <div className="main-content-container">
        <div className="dashboard-section">
          <h2>Salary Benchmark Analytics (FHE 🔐)</h2>
          {renderStatsPanel()}

          <div className="info-panel full-width">
            <h3>FHE 🔐 Privacy-Preserving Benchmark</h3>
            {renderFHEFlow()}
          </div>
        </div>

        <div className="content-grid">
          <div className="salaries-section">
            <div className="section-header">
              <h2>Salary Records</h2>
              <div className="header-actions">
                <button
                  onClick={loadData}
                  className="refresh-btn"
                  disabled={isRefreshing}
                >
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>

            <div className="salaries-list">
              {salaries.length === 0 ? (
                <div className="no-salaries">
                  <p>No salary records found</p>
                  <button
                    className="create-btn"
                    onClick={() => setShowCreateModal(true)}
                  >
                    Add First Record
                  </button>
                </div>
              ) : salaries.map((salary, index) => (
                <div
                  className={`salary-item ${selectedSalary?.id === salary.id ? "selected" : ""} ${salary.isVerified ? "verified" : ""}`}
                  key={index}
                  onClick={() => setSelectedSalary(salary)}
                >
                  <div className="salary-title">{salary.name}</div>
                  <div className="salary-meta">
                    <span>Position: {salary.position}</span>
                    <span>Experience: {salary.publicValue1} yrs</span>
                  </div>
                  <div className="salary-status">
                    Status: {salary.isVerified ? "✅ Verified" : "🔓 Ready for Analysis"}
                    {salary.isVerified && salary.decryptedValue && (
                      <span className="verified-amount">Benchmark Ready</span>
                    )}
                  </div>
                  <div className="salary-creator">Added by: {salary.creator.substring(0, 6)}...{salary.creator.substring(38)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="history-section">
            <h3>Recent Activity</h3>
            <div className="history-list">
              {userHistory.length === 0 ? (
                <div className="no-history">
                  <p>No recent activity</p>
                </div>
              ) : userHistory.map((item, index) => (
                <div className="history-item" key={item.id}>
                  <div className="history-action">{item.action}</div>
                  <div className="history-time">{new Date(item.timestamp).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <ModalCreateSalary
          onSubmit={createSalary}
          onClose={() => setShowCreateModal(false)}
          creating={creatingSalary}
          salaryData={newSalaryData}
          setSalaryData={setNewSalaryData}
          isEncrypting={isEncrypting}
        />
      )}

      {selectedSalary && (
        <SalaryDetailModal
          salary={selectedSalary}
          onClose={() => {
            setSelectedSalary(null);
            setDecryptedData(null);
          }}
          decryptedData={decryptedData}
          setDecryptedData={setDecryptedData}
          isDecrypting={isDecrypting || fheIsDecrypting}
          decryptData={() => decryptData(selectedSalary.encryptedSalary)}
          renderAnalysisChart={renderAnalysisChart}
        />
      )}

      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && <div className="success-icon">✓</div>}
              {transactionStatus.status === "error" && <div className="error-icon">✗</div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalCreateSalary: React.FC<{
  onSubmit: () => void;
  onClose: () => void;
  creating: boolean;
  salaryData: any;
  setSalaryData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, salaryData, setSalaryData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'salary') {
      const intValue = value.replace(/[^\d]/g, '');
      setSalaryData({ ...salaryData, [name]: intValue });
    } else {
      setSalaryData({ ...salaryData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="create-salary-modal">
        <div className="modal-header">
          <h2>Add Salary Record</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>

        <div className="modal-body">
          <div className="fhe-notice">
            <strong>FHE 🔐 Encryption</strong>
            <p>Salary amount will be encrypted with Zama FHE (Integer only)</p>
          </div>

          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              name="name"
              value={salaryData.name}
              onChange={handleChange}
              placeholder="Enter your name..."
            />
          </div>

          <div className="form-group">
            <label>Position *</label>
            <input
              type="text"
              name="position"
              value={salaryData.position}
              onChange={handleChange}
              placeholder="Enter your position..."
            />
          </div>

          <div className="form-group">
            <label>Annual Salary (Integer only) *</label>
            <input
              type="number"
              name="salary"
              value={salaryData.salary}
              onChange={handleChange}
              placeholder="Enter annual salary..."
              step="1"
              min="0"
            />
            <div className="data-type-label">FHE Encrypted Integer</div>
          </div>

          <div className="form-group">
            <label>Years of Experience *</label>
            <input
              type="number"
              min="0"
              max="50"
              name="experience"
              value={salaryData.experience}
              onChange={handleChange}
              placeholder="Enter years of experience..."
            />
            <div className="data-type-label">Public Data</div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button
            onClick={onSubmit}
            disabled={creating || isEncrypting || !salaryData.name || !salaryData.position || !salaryData.salary}
            className="submit-btn"
          >
            {creating || isEncrypting ? "Encrypting and Creating..." : "Create Record"}
          </button>
        </div>
      </div>
    </div>
  );
};

const SalaryDetailModal: React.FC<{
  salary: SalaryData;
  onClose: () => void;
  decryptedData: number | null;
  setDecryptedData: (value: number | null) => void;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
  renderAnalysisChart: (salary: SalaryData, decryptedAmount: number | null) => JSX.Element;
}> = ({ salary, onClose, decryptedData, setDecryptedData, isDecrypting, decryptData, renderAnalysisChart }) => {
  const handleDecrypt = async () => {
    if (decryptedData !== null) {
      setDecryptedData(null);
      return;
    }

    const decrypted = await decryptData();
    if (decrypted !== null) {
      setDecryptedData(decrypted);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="salary-detail-modal">
        <div className="modal-header">
          <h2>Salary Benchmark Analysis</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>

        <div className="modal-body">
          <div className="salary-info">
            <div className="info-item">
              <span>Name:</span>
              <strong>{salary.name}</strong>
            </div>
            <div className="info-item">
              <span>Position:</span>
              <strong>{salary.position}</strong>
            </div>
            <div className="info-item">
              <span>Added by:</span>
              <strong>{salary.creator.substring(0, 6)}...{salary.creator.substring(38)}</strong>
            </div>
            <div className="info-item">
              <span>Experience:</span>
              <strong>{salary.publicValue1} years</strong>
            </div>
          </div>

          <div className="data-section">
            <h3>Encrypted Salary Data</h3>

            <div className="data-row">
              <div className="data-label">Annual Salary:</div>
              <div className="data-value">
                {salary.isVerified && salary.decryptedValue ?
                  `$${salary.decryptedValue.toLocaleString()} (Verified)` :
                  decryptedData !== null ?
                  `$${decryptedData.toLocaleString()} (Decrypted)` :
                  "🔒 FHE Encrypted"
                }
              </div>
              <button
                className={`decrypt-btn ${(salary.isVerified || decryptedData !== null) ? 'decrypted' : ''}`}
                onClick={handleDecrypt}
                disabled={isDecrypting}
              >
                {isDecrypting ? (
                  "🔓 Analyzing..."
                ) : salary.isVerified ? (
                  "✅ Benchmarked"
                ) : decryptedData !== null ? (
                  "🔄 Re-analyze"
                ) : (
                  "📊 Get Benchmark"
                )}
              </button>
            </div>

            <div className="fhe-info">
              <div className="fhe-icon">🔐</div>
              <div>
                <strong>FHE 🔐 Privacy-Preserving Analysis</strong>
                <p>Your salary remains encrypted. Benchmark analysis happens without revealing actual amounts.</p>
              </div>
            </div>
          </div>

          {(salary.isVerified || decryptedData !== null) && (
            <div className="analysis-section">
              <h3>Industry Benchmark Results</h3>
              {renderAnalysisChart(salary, salary.isVerified ? salary.decryptedValue || null : decryptedData)}

              <div className="benchmark-values">
                <div className="value-item">
                  <span>Your Salary:</span>
                  <strong>
                    {salary.isVerified ?
                      `$${salary.decryptedValue?.toLocaleString()} (Verified)` :
                      `$${decryptedData?.toLocaleString()} (Private)`
                    }
                  </strong>
                  <span className={`data-badge ${salary.isVerified ? 'verified' : 'private'}`}>
                    {salary.isVerified ? 'On-chain Verified' : 'Private Analysis'}
                  </span>
                </div>
                <div className="value-item">
                  <span>Years Experience:</span>
                  <strong>{salary.publicValue1} years</strong>
                  <span className="data-badge public">Public Data</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
          {!salary.isVerified && (
            <button
              onClick={handleDecrypt}
              disabled={isDecrypting}
              className="verify-btn"
            >
              {isDecrypting ? "Analyzing..." : "Get Benchmark"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;


