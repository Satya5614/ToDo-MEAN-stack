var app = angular.module('ToDoApp', ['ngRoute','ui.bootstrap', 'ui.bootstrap.datetimepicker']);

app.run(function ($rootScope, $location, $route, AuthFactory) {
  $rootScope.$on('$routeChangeStart', function (event, next, current) {
  	
  	AuthFactory.isAuthorized().then(function () {
        $location.path('/todos');
    }).catch(function () {
        $location.path('/login');
    });
    
    //console.log(current);
    
    // if (next.access.restricted && AuthFactory.isLoggedIn() === false) {
    // 	$location.path('/login');
    // 	$route.reload();
    // }
    
  });
});

app.controller('taskCtrl', function ($scope, $http, $location, AuthFactory) {
	$scope.tasks;
	$scope.task = {};
	$http.get('/task').success(function(response){
		$scope.tasks = response;	
	}).error(function (err) {
		console.log(err);
		$location.path('/login');
	});
	
	
	$scope.dateTimeNow = function() {
		$scope.date = new Date();
	};
  	$scope.dateTimeNow();
  	$scope.hourStep = 1;
	$scope.minuteStep = 15;
	$scope.showMeridian = true;
	
	$scope.timeToggleMode = function() {
		$scope.showMeridian = !$scope.showMeridian;
	};
	
	$scope.$watch("date", function(value) {
		$scope.task.due_date=value;
	}, true);
	
	
	
	$scope.addTask = function() {
		$scope.task = {
			user_id: AuthFactory.getUserId(),
			task: $scope.task.task,
			status: 0,
			location: $scope.task.location,
			due_date: $scope.task.due_date
		};
		$http.post('/task', $scope.task).success(function(response){
			//console.log(response);
			$scope.tasks.push(response);
		});
		$scope.task = {};
	}
	
	$scope.changeTaskStatus = function(task) {
		var index = $scope.tasks.indexOf(task);
		$("#taskId"+index+" label").toggleClass("done");
		task.status == 0 ? task.status = 1 : task.status = 0;
		$http.put('/task/'+task._id, task).success(function(response) {
			//console.log(response);
		});
	}
	
	$scope.deleteTask = function(task) {
		$http.delete('/task/'+task._id).success(function(response){
			var index = $scope.tasks.indexOf(task);
			$scope.tasks.splice(index, 1);
			//console.log(response);	
		});
	}
	
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(function(position) {
			getlocation("map", position.coords.latitude, position.coords.longitude);
		},showGeolocationError);
	} else {
		alert("Sorry, we could not detect your location.");
		getlocation("map");
	}
	
	function getlocation(id, lat, lon) {
		$('#maps').locationpicker({
			location: {latitude: lat, longitude: lon},
			enableAutocomplete: true,
			radius: 200,
			enableReverseGeocode: true,
			inputBinding: {
				latitudeInput: $('#lat'),
				longitudeInput: $('#lon'),
				locationNameInput: $('#location')
			}
		});
	}
	
	function showGeolocationError(error) {
		switch(error.code) {
			case error.PERMISSION_DENIED:
				alert("User denied the request for Geolocation.")
				break;
			case error.POSITION_UNAVAILABLE:
				alert("Location information is unavailable.")
				break;
			case error.TIMEOUT:
				alert("The request to get user location timed out.")
				break;
			case error.UNKNOWN_ERROR:
				alert("An unknown error occurred.")
				break;
		}
		getlocation("map", "28.5556187", "77.0800402");
	}
	
 //   $('.datepicker').pickadate({
	// 	format: 'dd mmm, yyyy',
	// 	formatSubmit: 'yyyy/mm/dd',
	// });
	
});

app.controller('loginCtrl', function($scope, $location, $http, AuthFactory) {
    $scope.user = {};
    $scope.login = function(){
		$scope.error = false;
		$scope.disabled = true;
		
		AuthFactory.login($scope.user.username, $scope.user.password)
        .then(function () {
          $scope.disabled = false;
          $scope.user = {};
          $location.path('/todos');
        })
        .catch(function () {
          $scope.error = true;
          $scope.errorMessage = "Invalid username and/or password";
          $scope.disabled = false;
          $scope.user = {};
        });
    }
});

app.controller('logoutCtrl',function ($scope, $location, AuthFactory) {
	//$scope.logout = function () {
		// AuthFactory.logout()
		//.then(function () {
			//$location.path('/login');
		//});
	//};
	if(AuthFactory.userId!=null){
		console.log(AuthFactory.userId);
		$scope.logout = true;
	}else{
		console.log(AuthFactory.userId);
		$scope.logout = false;
	}
});

app.config(function($routeProvider){
	$routeProvider.
    when('/login', {
        templateUrl: 'templates/login.html',
        controller: 'loginCtrl',
        access: {restricted: false}
    }).
    when('/todos', {
        templateUrl: 'templates/task.html',
        controller: 'taskCtrl',
        access: {restricted: true}
    }).
    otherwise({
        redirectTo: '/todos'
    });	
});

app.factory('AuthFactory', function($q, $timeout, $http) {
	var user = null;
	var userId = null;
	
	function isAuthorized() {
		var deferred = $q.defer();
		$http.get('/user')
		.success(function (data, status) {
			if(status === 200){
				userId = data;
				deferred.resolve();
			} else {
				deferred.reject();
			}
		})
		.error(function (data) {
			deferred.reject();
		});
		return deferred.promise;
	}
	
	function isLoggedIn() {
        if(user) {
			return true;
        } else {
			return false;
        }
    }
	
	function getUserId() {
		return userId;
	}
	
	function login(username, password) {
		var deferred = $q.defer();
		$http.post('/login', {username: username, password: password})
		.success(function (data, status) {
			if(status === 200 && data.status){
				user = true;
				deferred.resolve();
			} else {
				user = false;
				deferred.reject();
			}
		})
		.error(function (data) {
			user = false;
			alert(data.err.message);
			deferred.reject();
		});
		return deferred.promise;
	}
	
	function logout() {
		var deferred = $q.defer();
		$http.get('/logout')
		.success(function (data) {
			user = false;
			deferred.resolve();
		})
		.error(function (data) {
			user = false;
			deferred.reject();
		});
		return deferred.promise;
	}
	
	return ({
      isLoggedIn: isLoggedIn,
      isAuthorized: isAuthorized,
      getUserId: getUserId,
      login: login,
      logout: logout
    });
});

