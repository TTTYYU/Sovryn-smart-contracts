/** Speed optimized on branch hardhatTestRefactor, 2021-10-01
 * Bottleneck found at beforeEach hook, redeploying tokens,
 *  protocol, ... on every test.
 *
 * Total time elapsed: 9.1s
 * After optimization: 6.6s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 */

const { BN } = require("@openzeppelin/test-helpers");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;

const FeesEvents = artifacts.require("FeesEvents");

const {
	getSUSD,
	getRBTC,
	getWRBTC,
	getBZRX,
	getLoanTokenLogic,
	getLoanToken,
	getLoanTokenLogicWrbtc,
	getLoanTokenWRBTC,
	loan_pool_setup,
	set_demand_curve,
	getPriceFeeds,
	getSovryn,
	getSOV,
} = require("../Utils/initializer.js");

const { liquidate, liquidate_healthy_position_should_fail } = require("./liquidationFunctions");

/*
Should test the liquidation handling
1. Liquidate a position
2. Should fail to liquidate a healthy position
*/

contract("ProtocolLiquidationTestToken", (accounts) => {
	let owner;
	let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC, priceFeeds, SOV;

	async function deploymentAndInitFixture(_wallets, _provider) {
		// Deploying sovrynProtocol w/ generic function from initializer.js
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);

		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);

		const loanTokenLogicStandard = await getLoanTokenLogic();
		const loanTokenLogicWrbtc = await getLoanTokenLogicWrbtc();
		loanToken = await getLoanToken(loanTokenLogicStandard, owner, sovryn, WRBTC, SUSD);
		loanTokenWRBTC = await getLoanTokenWRBTC(loanTokenLogicWrbtc, owner, sovryn, WRBTC, SUSD);
		await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);

		/// @dev SOV test token deployment w/ initializer.js
		SOV = await getSOV(sovryn, priceFeeds, SUSD, accounts);
	}

	before(async () => {
		[owner] = accounts;
	});

	beforeEach(async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	describe("Tests liquidation handling ", () => {
		/*
			Test with different rates so the currentMargin is <= liquidationIncentivePercent
			or > liquidationIncentivePercent
			liquidationIncentivePercent = 5e18 by default
		*/
		it("Test liquidate with rate 1e21", async () => {
			const rate = new BN(10).pow(new BN(21));
			await liquidate(accounts, loanToken, SUSD, set_demand_curve, RBTC, sovryn, priceFeeds, rate, WRBTC, FeesEvents, SOV);
		});

		it("Test liquidate with rate 1e21 (special rebates)", async () => {
			const rate = new BN(10).pow(new BN(21));
			await liquidate(accounts, loanToken, SUSD, set_demand_curve, RBTC, sovryn, priceFeeds, rate, WRBTC, FeesEvents, SOV, true);
		});

		it("Test liquidate with rate 6.7e21", async () => {
			const rate = new BN(67).mul(new BN(10).pow(new BN(20)));
			await liquidate(accounts, loanToken, SUSD, set_demand_curve, RBTC, sovryn, priceFeeds, rate, WRBTC, FeesEvents, SOV);
		});

		it("Test liquidate with rate 6.7e21 (special rebates)", async () => {
			const rate = new BN(67).mul(new BN(10).pow(new BN(20)));
			await liquidate(accounts, loanToken, SUSD, set_demand_curve, RBTC, sovryn, priceFeeds, rate, WRBTC, FeesEvents, SOV, true);
		});

		it("Test coverage: Trigger maxLiquidatable: ad hoc rate to be unhealthy and currentMargin > incentivePercent", async () => {
			/// @dev Healthy when rate aprox. > 8*10^21
			/// @dev We need unhealthy to liquidate
			/// @dev Not enough margin when rate aprox. < 7*10^21

			/// @dev This rate triggers the maxLiquidatable computation in the contract
			///   but the uncovered conditions:
			///     if (maxLiquidatable > principal) {
			///   and
			///     if (maxSeizable > collateral) {
			///   cannot ever be met inside the range (8*10^21 > rate > 7*10^21)

			const rate = new BN(10).pow(new BN(20)).mul(new BN(72));

			/// @dev It should liquidate but not entirely:
			///   principal            = 20267418874797325811
			///   maxLiquidatable      = 18355350998378606486
			///   Do not check RepayAmount => last parameter set to false
			await liquidate(
				accounts,
				loanToken,
				SUSD,
				set_demand_curve,
				RBTC,
				sovryn,
				priceFeeds,
				rate,
				WRBTC,
				FeesEvents,
				SOV,
				false,
				false
			);
		});

		/*
			Test if fails when the position is healthy currentMargin > maintenanceRate
		*/
		it("Test liquidate healthy position should fail", async () => {
			await liquidate_healthy_position_should_fail(accounts, loanToken, SUSD, set_demand_curve, RBTC, sovryn, priceFeeds, WRBTC);
		});
	});
});
