import React, { Component } from "react";
import * as moment from 'moment';

import HumanityRegistryJSON from "./contracts/HumanityRegistry.json";
import HumanityGovernanceJSON from "./contracts/HumanityGovernance.json";
import TwitterHumanityApplicantJSON from "./contracts/TwitterHumanityApplicant.json";
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
};

const results = {
  0: <span className="text-info">Pending</span>,
  1: <span className="text-success">Yes</span>,
  2: <span className="text-danger">No</span>,
};
const resultIdxToString = resultIdx => {
  return results[resultIdx];
};

const addressToEtherscanLink = (address) => {
  return <a href={ `https://etherscan.io/address/${address}` } target="_blank" rel="noopener noreferrer">{ address }</a>;
};

const txHashToEtherscanLink = (txHash) => {
  // const shortenTxHash = `${txHash.substring(0, 8)}...`
  return <a href={ `https://etherscan.io/tx/${txHash}` } target="_blank" rel="noopener noreferrer">{ txHash }</a>;
};

const twitterUsernameToLink = (username) => {
  return <a href={ `https://twitter.com/${username}` } target="_blank" rel="noopener noreferrer">@{ username }</a>;
};

class App extends Component {
  state = {
    web3: null,
    accounts: null,
    humanityRegistryContract: null,
    humanityGovernanceContract: null,
    twitterHumanityApplicantContract: null,
    textToSearch: '',
    proposal: null,
    voteEvents: [],
    removeVoteEvents: [],
    applyEventsFromAddress: [],
    applyEventsFromProposalId: [],
    searchedAddress: '',
    isSearching: false,
  };

  componentDidMount = async () => {
    try {
      // Get network provider and web3 instance.
      const web3 = await getWeb3();

      // Use web3 to get the user's accounts.
      const accounts = await web3.eth.getAccounts();

      const mainnetNetworkId = 1;
      const humanityRegistryContract = new web3.eth.Contract(
        HumanityRegistryJSON.abi,
        HumanityRegistryJSON.networks[mainnetNetworkId].address
      );
      const humanityGovernanceContract = new web3.eth.Contract(
        HumanityGovernanceJSON.abi,
        HumanityGovernanceJSON.networks[mainnetNetworkId].address
      );
      const twitterHumanityApplicantContract = new web3.eth.Contract(
        TwitterHumanityApplicantJSON.abi,
        TwitterHumanityApplicantJSON.networks[mainnetNetworkId].address
      );

      // Set web3, accounts, and contract to the state, and then proceed with an
      // example of interacting with the contract's methods.
      await this.setState({
        web3,
        accounts,
        humanityRegistryContract,
        humanityGovernanceContract,
        twitterHumanityApplicantContract,
      });
      this.fetchProposalState('136');
    } catch (error) {
      // Catch any errors for any of the above operations.
      alert(
        `Failed to load web3, accounts, or contract. Check console for details.`,
      );
      console.error(error);
    }
  };

  fetchProposalState = async (textToSearch) => {
    const {
      web3,
      // humanityRegistryContract,
      humanityGovernanceContract,
      twitterHumanityApplicantContract,
    } = this.state;

    this.setState({ isSearching: true });

    try {
      let proposalIdStr = textToSearch;

      if (web3.utils.isAddress(textToSearch)) {
        const searchingAddress = textToSearch;

        const applyEventsFromAddress = await twitterHumanityApplicantContract.getPastEvents('Apply', {
          filter: {
            applicant: searchingAddress,
          },
          fromBlock: 7723946,
        });
        console.log('applyEventsFromAddress', applyEventsFromAddress);
        this.setState({
          searchingAddress,
          applyEventsFromAddress,
        });

        if (applyEventsFromAddress.length > 0) {
          proposalIdStr = applyEventsFromAddress[applyEventsFromAddress.length - 1].returnValues.proposalId;
        }
      }
      // else if (isNaN(textToSearch)) {
      //   // assume `textToSearch` is a twitter handle
      //   const twitterHandle = textToSearch;

      //   const applyEventsFromTwitterHandle = await twitterHumanityApplicantContract.getPastEvents('Apply', {
      //     filter: {
      //       username: twitterHandle,
      //     },
      //     fromBlock: 7723946,
      //   });
      //   console.log('applyEventsFromTwitterHandle', applyEventsFromTwitterHandle);
      // }
      else {
        this.setState({
          searchingAddress: '',
          applyEventsFromAddress: [],
        });
      }

      const [proposal, voteEvents, removeVoteEvents, applyEventsFromProposalId] = await Promise.all([
        humanityGovernanceContract.methods.getProposal(proposalIdStr).call(),
        humanityGovernanceContract.getPastEvents('Vote', {
          filter: {
            proposalId: proposalIdStr,
          },
          fromBlock: 7723872,
        }),
        humanityGovernanceContract.getPastEvents('RemoveVote', {
          filter: {
            proposalId: proposalIdStr,
          },
          fromBlock: 7723872,
        }),
        twitterHumanityApplicantContract.getPastEvents('Apply', {
          filter: {
            proposalId: proposalIdStr,
          },
          fromBlock: 7723946,
        }),
      ]);
      proposal.proposalIdStr = proposalIdStr;
      console.log('proposal', proposal);
      console.log('voteEvents', voteEvents);
      console.log('removeVoteEvents', removeVoteEvents);
      console.log('applyEventsFromProposalId', applyEventsFromProposalId);

      this.setState({
        isSearching: false,
        proposal,
        voteEvents,
        removeVoteEvents,
        applyEventsFromProposalId,
      });
    } catch (error) {
      console.error(error);
      alert('Wrong Proposal ID or Address.')
      this.setState({ isSearching: false });
    }
  };

  handleProposalIdTextChange = event => {
    this.setState({textToSearch: event.target.value.trim()});
  }

  handleSearch = event => {
    event.preventDefault();
    this.fetchProposalState(this.state.textToSearch);
  }

  render() {
    const {
      web3,
      applyEventsFromAddress,
      // searchingAddress,
      proposal,
      voteEvents,
      removeVoteEvents,
      applyEventsFromProposalId,
      isSearching,
    } = this.state;

    if (!web3) {
      return (
        <div className="text-center pt-5">
          <div className="spinner-grow" role="status">
            <span className="sr-only">Loading...</span>
          </div>
        </div>
      );
    }
    return (
      <div className="App">
        <nav className="navbar justify-content-start navbar-light bg-light">
          <span className="navbar-brand mb-0 h1">HumanityDAO Applicant Status Checker</span>
          <a className="nav-link" href="https://humanitydao.org/" target="_blank" rel="noopener noreferrer">Humanity</a>
          <a className="nav-link" href="https://discord.gg/yvUqPUn" target="_blank" rel="noopener noreferrer">Discord</a>
        </nav>

        <div className="container pt-3 pb-3">
          <form onSubmit={this.handleSearch} className="form-inline justify-content-center mb-5">
            <input type="text" className="form-control" value={this.state.textToSearch} onChange={this.handleProposalIdTextChange} placeholder="Proposal ID or Address" />
            <input type="submit" className="btn btn-primary" value="Search" />
          </form>

          { isSearching &&
            <div className="text-center">
              <div className="spinner-grow" role="status">
                <span className="sr-only">Loading...</span>
              </div>
            </div>
          }

          { applyEventsFromAddress.length > 0 &&
            <div className="mb-5">
              <div className="section-title">Proposals from Address</div>
              <div>
                {
                  applyEventsFromAddress.map(event => {
                    return <span key={ 'apply-' + event.returnValues.proposalId.toString() }>#{ event.returnValues.proposalId.toString() } </span>
                  })
                }
              </div>
            </div>
          }

          { proposal &&
            <div className="mb-5">
              <div className="section-title">Proposal</div>
              <table className="table table-bordered">
                <tbody>
                  <tr>
                    <td className="bg-gray">Proposal ID</td>
                    <td>{ proposal.proposalIdStr.toString() }</td>
                  </tr>
                  <tr>
                    <td className="bg-gray">Address</td>
                    <td className="td-address">{ addressToEtherscanLink(proposal.feeRecipient) }</td>
                  </tr>
                  <tr>
                    <td className="bg-gray">Twitter</td>
                    <td>{ twitterUsernameToLink(applyEventsFromProposalId[0].returnValues.username) }</td>
                  </tr>
                  <tr>
                    <td className="bg-gray">Starting Time</td>
                    <td>{ moment.unix(parseInt(proposal.startTime)).format('MMM DD YYYY HH:mm:ss Z') }</td>
                    {/* <td>{ (new Date(parseInt(proposal.startTime) * 1000)).toISOString() }</td> */}
                  </tr>
                  <tr>
                    <td className="bg-gray">Votes (Yes / No)</td>
                    <td>{ formatStrWithYesNo(true, web3.utils.fromWei(proposal.yesCount.toString())) } / { formatStrWithYesNo(false, web3.utils.fromWei(proposal.noCount.toString())) }</td>
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
            <div className="mb-5">
              <div className="section-title">Vote Events</div>
              <table className="table table-bordered">
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
                      <td className="td-tx">{ txHashToEtherscanLink(event.transactionHash) }</td>
                      {/* <td>{ moment.unix(parseInt(event.startTime)).format('MMM DD YYYY HH:mm:ss Z') }</td> */}
                      <td className="td-address">{ addressToEtherscanLink(values.voter) }</td>
                      <td>{ boolToYesNo(values.approve) }</td>
                      <td>{ formatStrWithYesNo(values.approve, web3.utils.fromWei(values.weight.toString())) }</td>
                    </tr>;
                  })
                }
                </tbody>
              </table>
            </div>
          }

          { removeVoteEvents.length > 0 &&
            <div className="mb-5">
              <div className="section-title">RemoveVote Events</div>
            <table className="table table-bordered">
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
                      <td className="td-tx">{ txHashToEtherscanLink(event.transactionHash) }</td>
                      <td className="td-address">{ addressToEtherscanLink(values.voter) }</td>
                    </tr>;
                  })
                }
                </tbody>
              </table>
            </div>
          }
        </div>

        <footer className="footer bg-light text-center">
          <div className="container">
            <div className="text-muted"><a href="https://github.com/Roger-Wu/humanitydao-applicant-status-checker" target="_blank" rel="noopener noreferrer">Source Code on GitHub</a></div>
            <div className="text-muted">Donate ETH or tokens: { addressToEtherscanLink('0x36fAa1e49fF125ac72ceae0d5a2E35bC9aDD6591') }</div>
          </div>
        </footer>
      </div>
    );
  }
}

export default App;
