import React, { Component } from "react";
import * as moment from 'moment';

import HumanityRegistryJSON from "./contracts/HumanityRegistry.json";
import HumanityGovernanceJSON from "./contracts/HumanityGovernance.json";
import getWeb3 from "./utils/getWeb3";

import "./App.css";

const boolToYesNo = (isYes) => {
  if (isYes) {
    return <span className="text-success">Yes</span>
  } else {
    return <span className="text-danger">No</span>
  }
}

const formatStrWithYesNo = (isYes, str) => {
  if (isYes) {
    return <span className="text-success">{ str }</span>
  } else {
    return <span className="text-danger">{ str }</span>
  }
}

const results = {
  0: <span className="text-info">Pending</span>,
  1: <span className="text-success">Yes</span>,
  2: <span className="text-danger">No</span>,
};
const resultIdxToString = resultIdx => {
  return results[resultIdx];
};

const addressToEtherscanLink = (address) => {
  return <a href={ `https://etherscan.io/address/${address}` } target="_blank" rel="noopener noreferrer">{ address }</a>
}

const txHashToEtherscanLink = (txHash) => {
  const shortenTxHash = `${txHash.substring(0, 8)}...`
  return <a href={ `https://etherscan.io/tx/${txHash}` } target="_blank" rel="noopener noreferrer">{ shortenTxHash }</a>
}

class App extends Component {
  state = {
    web3: null,
    accounts: null,
    humanityRegistryContract: null,
    humanityGovernanceContract: null,
    proposalIdText: '',
    proposal: null,
    voteEvents: [],
    removeVoteEvents: [],
    isSearching: false,
  };

  componentDidMount = async () => {
    try {
      // Get network provider and web3 instance.
      const web3 = await getWeb3();

      // Use web3 to get the user's accounts.
      const accounts = await web3.eth.getAccounts();

      // // Get the contract instance.
      // const networkId = await web3.eth.net.getId();
      // if (networkId !== 1) {
      //   alert(
      //     `Please switch to Ethereum Mainnet`
      //   );
      // }

      const mainnetNetworkId = 1;
      const humanityRegistryContract = new web3.eth.Contract(
        HumanityRegistryJSON.abi,
        HumanityRegistryJSON.networks[mainnetNetworkId].address
      );
      const humanityGovernanceContract = new web3.eth.Contract(
        HumanityGovernanceJSON.abi,
        HumanityGovernanceJSON.networks[mainnetNetworkId].address
      );

      // Set web3, accounts, and contract to the state, and then proceed with an
      // example of interacting with the contract's methods.
      this.setState({
        web3,
        accounts,
        humanityRegistryContract,
        humanityGovernanceContract,
      });
    } catch (error) {
      // Catch any errors for any of the above operations.
      alert(
        `Failed to load web3, accounts, or contract. Check console for details.`,
      );
      console.error(error);
    }
  };

  // fetchProposalIdFromAddress

  fetchProposalState = async () => {
    const {
      proposalIdText,
      humanityRegistryContract,
      humanityGovernanceContract,
    } = this.state;

    this.setState({ isSearching: true });

    try {
      const [proposal, voteEvents, removeVoteEvents] = await Promise.all([
        humanityGovernanceContract.methods.getProposal(proposalIdText).call(),
        humanityGovernanceContract.getPastEvents('Vote', {
          filter: {
            proposalId: proposalIdText,
          },
          fromBlock: 7723872,
        }),
        humanityGovernanceContract.getPastEvents('RemoveVote', {
          filter: {
            proposalId: proposalIdText,
          },
          fromBlock: 7723872,
        }),
      ]);
      console.log('proposal', proposal);
      console.log('voteEvents', voteEvents);
      console.log('removeVoteEvents', removeVoteEvents);

      this.setState({
        isSearching: false,
        proposal,
        voteEvents,
        removeVoteEvents,
      });
    } catch (error) {
      console.error(error);
      this.setState({ isSearching: false });
    }
  };

  handleProposalIdTextChange = event => {
    this.setState({proposalIdText: event.target.value});
  }

  handleSearch = event => {
    event.preventDefault();
    this.fetchProposalState();
  }

  render() {
    const {
      web3,
      proposal,
      voteEvents,
      removeVoteEvents,
      isSearching,
    } = this.state;

    if (!web3) {
      return <div>Loading Web3, accounts, and contract...</div>;
    }
    return (
      <div className="App">
        <nav className="navbar navbar-light bg-light">
          <span className="navbar-brand mb-0 h1">HumanityDAO Applicant Status Checker</span>
        </nav>

        <div className="container pt-3 pb-3">
          <form onSubmit={this.handleSearch} className="form-inline justify-content-center mb-5">
            <input type="text" pattern="\d*" className="form-control" value={this.state.proposalIdText} onChange={this.handleProposalIdTextChange} placeholder="Proposal ID" />
            <input type="submit" className="btn btn-primary" value="Search" />
          </form>

          { isSearching &&
            <div className="spinner-grow" role="status">
              <span className="sr-only">Loading...</span>
            </div>
          }

          { proposal &&
            <div className="mb-3">
              <h3>Proposal</h3>
              <table className="table">
                <tbody>
                  <tr>
                    <td className="bg-gray">Applicant</td>
                    <td>{ addressToEtherscanLink(proposal.feeRecipient) }</td>
                  </tr>
                  <tr>
                    <td className="bg-gray">Starting Time</td>
                    <td>{ moment.unix(parseInt(proposal.startTime)).format('MMM DD YYYY HH:mm:ss Z') }</td>
                    {/* <td>{ (new Date(parseInt(proposal.startTime) * 1000)).toISOString() }</td> */}
                  </tr>
                  <tr>
                    <td className="bg-gray">Votes (Yes / No)</td>
                    <td>{ formatStrWithYesNo(true, web3.utils.fromWei(proposal.yesCount)) } / { formatStrWithYesNo(false, web3.utils.fromWei(proposal.noCount)) }</td>
                  </tr>
                  <tr>
                    <td className="bg-gray">Result</td>
                    <td>{ resultIdxToString(proposal.result) }</td>
                  </tr>
                </tbody>
              </table>
            </div>
          }

          { voteEvents.length > 0 &&
            <div className="mb-3">
              <h3>Votes</h3>
              <table className="table">
                <thead className="thead-light">
                  <tr>
                    <th>TX</th>
                    <th>Voter</th>
                    <th>Voted for</th>
                    <th>Weight</th>
                  </tr>
                </thead>
                <tbody>
                {
                  voteEvents.map((event, index) => {
                    const values = event.returnValues;
                    return <tr key={ 'vote-event-' + index }>
                      <td>{ txHashToEtherscanLink(event.transactionHash) }</td>
                      {/* <td>{ moment.unix(parseInt(event.startTime)).format('MMM DD YYYY HH:mm:ss Z') }</td> */}
                      <td>{ addressToEtherscanLink(values.voter) }</td>
                      <td>{ boolToYesNo(values.approve) }</td>
                      <td>{ formatStrWithYesNo(values.approve, web3.utils.fromWei(values.weight)) }</td>
                    </tr>;
                  })
                }
                </tbody>
              </table>
            </div>
          }

          { removeVoteEvents.length > 0 &&
            <div className="mb-3">
              <h3>Removed Votes</h3>
            <table className="table">
              <thead className="thead-light">
                <tr>
                  <th>TX</th>
                  <th>Voter</th>
                </tr>
              </thead>
              <tbody>
                {
                  removeVoteEvents.map((event, index) => {
                    const values = event.returnValues;
                    return <tr key={ 'vote-event-' + index }>
                      <td>{ txHashToEtherscanLink(event.transactionHash) }</td>
                      <td>{ addressToEtherscanLink(values.voter) }</td>
                    </tr>;
                  })
                }
                </tbody>
              </table>
            </div>
          }
        </div>

        <footer className="footer bg-light">
          <div className="container">
            <div className="text-muted">Source Code: <a href="https://github.com/Roger-Wu/humanitydao-applicant-status-checker" target="_blank" rel="noopener noreferrer">https://github.com/Roger-Wu/humanitydao-applicant-status-checker</a></div>
            <div className="text-muted">Donate ETH or ERC20 tokens: { addressToEtherscanLink('0x36fAa1e49fF125ac72ceae0d5a2E35bC9aDD6591') }</div>
          </div>
        </footer>
      </div>
    );
  }
}

export default App;
