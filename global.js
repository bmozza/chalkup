Games = new Meteor.Collection("games");

if(Meteor.isClient){
	
	Handlebars.registerHelper('name', function(id) {
		return Meteor.users.findOne({_id: id}).profile.name;
	});
	
	Handlebars.registerHelper('rating', function(id) {
		return Meteor.users.findOne({_id: id}).profile.rating;
	});

	Handlebars.registerHelper("date", function(datetime) {
		d =  new Date(datetime);
		return [d.getDate(), d.getMonth()+1, d.getFullYear()].join('/');
	});
	
	Handlebars.registerHelper('isUser', function(userId) {
		return Meteor.userId() == userId;

	});

	Template.search.currentGame = function(){
		game = Games.findOne({
			$or: [
				{challengerId: Meteor.userId()},
				{opponentId: Meteor.userId()}
			],
			finishedAt: null
		});
		Session.set("currentGame", game);
		return game
	};

	Template.search.increase = function(score){
		return parseInt(score) + 1;
	};

	Template.search.decrease = function(score){
		return parseInt(score) - 1;
	};

	Template.search.isZero = function(score){
		return parseInt(score) == 0;
	};

	Template.games.recentGames = function(){
		return Games.find({
			$or: [
				{challengerId: Meteor.userId()},
				{opponentId: Meteor.userId()}
			],
			finishedAt: {$gt: null}
		}, {limit: 3, sort: {finishedAt:-1}}).fetch();
	};

	Template.header.events({
	  'click .logout.btn': function(event, template){
			event.preventDefault();
			Meteor.logout();
	  },

	  'click .login .btn': function(event, template){
			event.preventDefault();
			var username = template.find("input[name='username']").value,
					password = template.find("input[name='password']").value;
			Meteor.loginWithPassword(username, password, function(error){
				console.log(error);
			});
	  }
	});

	Template.register.events({
	  'click .register .btn': function(event, template){
			event.preventDefault();
			var name = template.find("input[name='name']").value,
					username = template.find("input[name='username']").value,
					password = template.find("input[name='password']").value;
			Accounts.createUser({profile: {name: name}, username: username, password: password}, function(error){
				console.log(error);
			});
	  }
	});

	Template.search.users = function(){
		console.log(Session.get("keywords"));
		
			var keywords = new RegExp(Session.get("keywords"));
			return Meteor.users.find({
				'profile.name': { $regex: keywords, $options: "i" } 
			}, {limit: 10, sort: {'profile.rating':-1}});
		
	}

	Template.search.events({
	  'keyup .search': function(event, template){
			var keywords = template.find("input[name='keywords']").value;
			Session.set("keywords", keywords);
	  },
	
		'click .challenge': function(event, template){
			var opponentId = $(event.toElement).attr('id');
			Session.set("keywords", "");
			return Games.insert({
				challengerId: Meteor.userId(),
				opponentId: opponentId,
				challengerScore: 0,
				opponentScore: 0,
				startedAt: event.timeStamp
			});
		},
	
		'click .challenger .change': function(event, template){
			event.preventDefault();
			Games.update(Session.get("currentGame")._id, {
				$set: {challengerScore: event.target.value}
			});
			Meteor.call('rank', Session.get("currentGame").challengerId, Session.get("currentGame").opponentId);
	  },

		'click .opponent .change': function(event, template){
			event.preventDefault();
			Games.update(Session.get("currentGame")._id, {
				$set: {opponentScore: event.target.value}
			});
			Meteor.call('rank', Session.get("currentGame").opponentId, Session.get("currentGame").challengerId);
	  },
	
		'click .finish': function(event, template){
			event.preventDefault();
			Games.update(game._id, { 
				$set: {
					finishedAt: event.timeStamp
				} 
			});
	  }

	});
	
}

if(Meteor.isServer){
	
	Meteor.users.allow({
	  update: function (userId, doc, fields, modifier) {
			if(fields.length == 1 && fields[0] == 'profile'){
				return true;
			} else {
				return false;
			}
	  }
	});
	
	Meteor.methods({
	  rank: function(winnerId, loserId) {
			var winner = Meteor.users.find({_id: winnerId}).fetch()[0];			
			var loser = Meteor.users.find({_id: loserId}).fetch()[0];

			function expectedScore(playerRating, opponentRating){
				return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
			} 

			function eloRating(playerRating, expectedScore, score){
				return parseInt(playerRating + Math.min(16, (10 * (score - expectedScore))));
			}

			var winnerNewRating = eloRating(winner.profile.rating, expectedScore(winner.profile.rating, loser.profile.rating), 1);
			var loserNewRating = eloRating(loser.profile.rating, expectedScore(loser.profile.rating, winner.profile.rating), 0);
			
			Meteor.users.update(winner._id, {
				$set: {
					'profile.rating':  winnerNewRating
				} 
			});

			Meteor.users.update(loser._id, {
				$set: {
					'profile.rating': loserNewRating
				} 
			});
			
	  }
	});
	
  Meteor.startup(function(){
		if(Meteor.users.find().count() === 0){
			console.log('Building users');
			[
				"Ben Morrison",
		    "Mark Priest",
		    "Daniel Davy",
				"Anthony Grover",
				"Callum Full",
				"Darren Cross"
			].forEach(function(name){
				var username = name.split(" ")[0];
				var password = "pass";
				Accounts.createUser({profile: {name: name, rating: 1400}, username: username, password: password});
			});
		}
	});
}
