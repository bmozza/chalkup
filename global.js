Games = new Meteor.Collection("games");

if (Meteor.isClient) {
	
	Handlebars.registerHelper('name', function(id) {
		return Meteor.users.findOne({_id: id}).profile.name;
	});
	
	Handlebars.registerHelper('rating', function(id) {
		return Meteor.users.findOne({_id: id}).profile.rating;
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

	Template.games.finishedGames = function(){
		return Games.find({
			$or: [
				{challengerId: Meteor.userId()},
				{opponentId: Meteor.userId()}
			],
			finishedAt: {$gt: null}
		}).fetch();
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
		if(typeof Session.get("keywords") !== "undefined" && Session.get("keywords") !== ""){
			var keywords = new RegExp(Session.get("keywords"));
			return Meteor.users.find({
				_id: { $ne: Meteor.userId() },
				'profile.name': { $regex: keywords, $options: "i" } 
			}, {limit: 10});
		}
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
	  },

		'click .opponent .change': function(event, template){
			event.preventDefault();
			Games.update(Session.get("currentGame")._id, {
				$set: {opponentScore: event.target.value}
			});
	  },
	
		'click .finish': function(event, template){
			event.preventDefault();
			var game = Session.get("currentGame");
			Games.update(game._id, { 
				$set: {finishedAt: event.timeStamp} 
			});
			
			//Meteor.call('rank', game);

			var challenger = Meteor.users.find({_id: game.challengerId}).fetch()[0];			
			var opponent = Meteor.users.find({_id: game.opponentId}).fetch()[0];

			// TODO need to cater for a draw
			
			var winningScore = Math.max(game.challengerScore, game.opponentScore);
			var losingScore = Math.min(game.challengerScore, game.opponentScore);
			var totalFrames = winningScore + losingScore;
			var margin = winningScore - losingScore;
			var winner, loser;
			
			if(margin != 0 && winningScore == game.challengerScore){
				winner = challenger;
				loser = opponent;
			} else if (margin != 0 && winningScore == game.opponentScore){
				winner = opponent;	
				loser = challenger;
			}
			
			var winner_rating = parseInt(winner.profile.rating);
			var loser_rating = parseInt(loser.profile.rating);			
			
			if(winner_rating >= loser_rating){
				ranking_difference = 1;
			} else {
				ranking_difference = (loser_rating - winner_rating) / 4;
				ranking_difference = Math.min(5, ranking_difference);
				ranking_difference = Math.max(1, ranking_difference);
			}		
			
			var frame_percentage = winningScore / totalFrames;

			var total_frames = Math.min(10, totalFrames) / 10;
			
			var change = parseInt(ranking_difference * (frame_percentage + total_frames));
			
			Meteor.users.update(winner._id, {
				$set: {
					'profile.rating':  winner_rating + change,
					'profile.games': parseInt(winner.profile.games) + 1
				} 
			});
			
			Meteor.users.update(loser._id, {
				$set: {
					'profile.rating': loser_rating - change,
					'profile.games': parseInt(loser.profile.games) + 1
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
	  rank: function(game) {
			
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
				Accounts.createUser({profile: {name: name, rating: '50', games: '0'}, username: username, password: password});
			});
		}
	});
}
