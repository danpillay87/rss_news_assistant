
// =============== property validation 1 =================== 
const form = document.getElementById('property-form');
const propertyUserName = document.getElementById('propertyUserName');
const rss = document.getElementById('rss');
const propertyNameV = document.getElementById('propertyName');
const propertyAddressV = document.getElementById('assistantInstructions');
const models = document.querySelectorAll('input[name="model"]');
const select = document.getElementById('select-box');

form.addEventListener('submit', e => { 

	const propertyUserNameValue = propertyUserName.value.trim();
	const rssValue = rss.value.trim();
	const propertyNameValue = propertyNameV.value.trim();
	const propertyAddressValue = propertyAddressV.value.trim();
	let modelSelected = false;
	models.forEach(radio => {
		if (radio.checked) {
			modelSelected = true;
		}
	});


	if (propertyUserNameValue === '') {
		setError(propertyUserName, 'Username is a required field');
		e.preventDefault();
	} else {
		setSuccess(propertyUserName)
	}
	if (rssValue === '') {
		setError(rss, 'RSS is a required field');
		e.preventDefault();
	} else {
		setSuccess(rss)
	}
	if (propertyNameValue === '') {
		setError(propertyNameV, 'Assistant name is a required field');
		e.preventDefault();
	} else {
		setSuccess(propertyNameV)
	}

	if (propertyAddressValue === '') {
		setError(propertyAddressV, 'Assistant Instructions is a required field');
		e.preventDefault();
	} else {
		setSuccess(propertyAddressV)
	}
	if (!modelSelected) {
		setModelError(select, 'Model is a required field');
		e.preventDefault();
	} else {
		setModelSuccess(select);
	}

});

const setError = (element, message) => {
	const inputControl = element.parentElement.parentElement;
	const errorDisplay = inputControl.querySelector('.errormessage');

	errorDisplay.innerText = message;
	inputControl.classList.add('error');
}
const setSuccess = element => {
	const inputControl = element.parentElement.parentElement;
	const errorDisplay = inputControl.querySelector('.errormessage');

	errorDisplay.innerText = '';
	inputControl.classList.remove('error');
};

const setModelError = (element, message) => {
	const inputControl = element.parentElement;
	const errorDisplay = inputControl.querySelector('.errormessage');

	errorDisplay.innerText = message;
	inputControl.classList.add('error');
}
const setModelSuccess = element => {
	const inputControl = element.parentElement;
	const errorDisplay = inputControl.querySelector('.errormessage');

	errorDisplay.innerText = '';
	inputControl.classList.remove('error');
};


const isValidEmail = email => {
	const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	return re.test(String(email).toLowerCase());
}